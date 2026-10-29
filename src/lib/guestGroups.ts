import {
  collection, deleteDoc, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { ConceptEdge, ConceptNode } from './types';

export type GuestGroupSettings = {
  groupId: string;
  slug: string;
  title: string;
  description: string;
  guideEnabled: boolean;
  active: boolean;
  updatedAt?: unknown;
};

export type GuestPublication = {
  id: string;
  title: string;
  description: string;
  nodes: ConceptNode[];
  edges: ConceptEdge[];
  publishedAt?: unknown;
  updatedAt?: unknown;
};

export type GuestSettingsInput = {
  slug: string;
  title: string;
  description: string;
  guideEnabled: boolean;
};

function firestore() {
  if (!db) throw new Error('Firebase no configurado.');
  return db;
}

export function normalizeGuestSlug(value: string): string {
  const slug = value.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
  if (slug.length < 3 || slug.length > 60) {
    throw new Error('La dirección pública debe tener entre 3 y 60 caracteres.');
  }
  return slug;
}

function cleanText(value: string, label: string, min: number, max: number): string {
  const text = value.trim().replace(/\s+/g, ' ');
  if (text.length < min || text.length > max) {
    throw new Error(`${label}: introduzca entre ${min} y ${max} caracteres.`);
  }
  return text;
}

export function normalizeGuestSettings(input: GuestSettingsInput): GuestSettingsInput {
  return {
    slug: normalizeGuestSlug(input.slug),
    title: cleanText(input.title, 'Título público', 3, 100),
    description: cleanText(input.description, 'Descripción pública', 0, 400),
    guideEnabled: input.guideEnabled === true,
  };
}

/** La copia invitada contiene exclusivamente material ya publicado.
 * No incluye UID, identificadores de borrador ni identificadores de revisiones privadas. */
export function guestPublicationDocument(source: Record<string, unknown>) {
  if (typeof source.title !== 'string' || typeof source.description !== 'string' ||
      !Array.isArray(source.nodes) || !Array.isArray(source.edges) ||
      source.publishedAt === undefined || source.updatedAt === undefined) {
    throw new Error('La publicación académica no tiene un formato válido para invitados.');
  }
  return {
    title: source.title,
    description: source.description,
    nodes: source.nodes,
    edges: source.edges,
    publishedAt: source.publishedAt,
    updatedAt: source.updatedAt,
  };
}

export function guestGroupShareUrl(slug: string): string {
  const safeSlug = normalizeGuestSlug(slug);
  if (typeof window === 'undefined') return `#/invitados/${safeSlug}`;
  return `${window.location.origin}${window.location.pathname}#/invitados/${safeSlug}`;
}

export function guestPublicationPath(slug: string, publicationId: string): string {
  const safeSlug = normalizeGuestSlug(slug);
  const id = publicationId.trim();
  if (!id || id.includes('/')) throw new Error('Identificador de esquema público no válido.');
  return `/invitados/${safeSlug}/esquema/${encodeURIComponent(id)}`;
}

export function guestFigurePath(slug: string, publicationId: string): string {
  const safeSlug = normalizeGuestSlug(slug);
  const id = publicationId.trim();
  if (!id || id.includes('/')) throw new Error('Identificador de esquema público no válido.');
  return `/invitados/${safeSlug}/figura/${encodeURIComponent(id)}`;
}

function absoluteGuestHash(path: string): string {
  if (typeof window === 'undefined') return `#${path}`;
  return `${window.location.origin}${window.location.pathname}#${path}`;
}

/** Permalink canónico para citar o enlazar un esquema individual desde un artículo. */
export function guestPublicationShareUrl(slug: string, publicationId: string): string {
  return absoluteGuestHash(guestPublicationPath(slug, publicationId));
}

/** Vista compacta de figura; será la fuente visual de la exportación PNG de fase 4B. */
export function guestFigureShareUrl(slug: string, publicationId: string): string {
  return absoluteGuestHash(guestFigurePath(slug, publicationId));
}

export async function listGuestGroupSettingsForAdmin(): Promise<GuestGroupSettings[]> {
  const snapshot = await getDocs(collection(firestore(), 'guestGroups'));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as unknown as GuestGroupSettings));
}

/** Lee únicamente la configuración invitada de los grupos visibles para el usuario.
 * Los grupos privados que Firestore no permita consultar se omiten sin convertir
 * el estado público en un error de toda la biblioteca. */
export async function listGuestGroupSettingsForGroups(groupIds: string[]): Promise<GuestGroupSettings[]> {
  const instance = firestore();
  const uniqueIds = [...new Set(groupIds.map(value => value.trim()).filter(Boolean))];
  const results = await Promise.all(uniqueIds.map(async groupId => {
    try {
      const snapshot = await getDoc(doc(instance, 'guestGroups', groupId));
      if (!snapshot.exists()) return null;
      return { groupId, ...snapshot.data() } as GuestGroupSettings;
    } catch {
      // Un alumno puede consultar grupos públicos, pero no configuraciones privadas.
      // Omitirlas aquí preserva la biblioteca interna sin filtrar metadatos.
      return null;
    }
  }));
  return results.filter((item): item is GuestGroupSettings => item !== null);
}

/** Configuración atómica: el slug funciona como índice público, mientras el groupId permanece estable. */
export async function saveGuestGroupSettings(groupId: string, input: GuestSettingsInput): Promise<number> {
  const instance = firestore();
  const values = normalizeGuestSettings(input);
  const configRef = doc(instance, 'guestGroups', groupId);
  const nextSlugRef = doc(instance, 'guestGroupSlugs', values.slug);

  await runTransaction(instance, async transaction => {
    const current = await transaction.get(configRef);
    const targetSlug = await transaction.get(nextSlugRef);
    const previousSlug = current.exists() ? String(current.data().slug || '') : '';
    const oldSlugRef = previousSlug && previousSlug !== values.slug
      ? doc(instance, 'guestGroupSlugs', previousSlug)
      : null;
    const oldSlug = oldSlugRef ? await transaction.get(oldSlugRef) : null;

    if (targetSlug.exists() && targetSlug.data().groupId !== groupId) {
      throw new Error('Esa dirección pública ya pertenece a otro grupo. Elija otra.');
    }

    if (oldSlugRef && oldSlug?.exists() && oldSlug.data().groupId === groupId) {
      transaction.delete(oldSlugRef);
    }

    transaction.set(configRef, {
      groupId,
      ...values,
      active: true,
      updatedAt: serverTimestamp(),
    });
    transaction.set(nextSlugRef, {
      groupId,
      slug: values.slug,
      active: true,
      updatedAt: serverTimestamp(),
    });
  });

  return syncGuestGroupPublications(groupId);
}

export async function disableGuestGroup(groupId: string): Promise<void> {
  const instance = firestore();
  const configRef = doc(instance, 'guestGroups', groupId);
  await runTransaction(instance, async transaction => {
    const current = await transaction.get(configRef);
    if (!current.exists()) return;
    const slug = String(current.data().slug || '');
    const slugRef = slug ? doc(instance, 'guestGroupSlugs', slug) : null;
    const slugSnapshot = slugRef ? await transaction.get(slugRef) : null;
    transaction.update(configRef, { active: false, updatedAt: serverTimestamp() });
    if (slugRef && slugSnapshot?.exists() && slugSnapshot.data().groupId === groupId) transaction.delete(slugRef);
  });
}

/** Al activar el acceso invitado, refleja todas las ediciones académicas vigentes.
 * Los writes se hacen individualmente para no agotar el presupuesto de reglas en un batch grande. */
export async function syncGuestGroupPublications(groupId: string): Promise<number> {
  const instance = firestore();
  const config = await getDoc(doc(instance, 'guestGroups', groupId));
  if (!config.exists() || config.data().active !== true) return 0;

  const source = await getDocs(collection(instance, 'groupPublications', groupId, 'diagrams'));
  const target = await getDocs(collection(instance, 'guestGroups', groupId, 'publications'));
  const sourceIds = new Set(source.docs.map(item => item.id));

  for (const item of source.docs) {
    await setDoc(
      doc(instance, 'guestGroups', groupId, 'publications', item.id),
      guestPublicationDocument(item.data()),
    );
  }
  for (const item of target.docs) {
    if (!sourceIds.has(item.id)) await deleteDoc(item.ref);
  }
  return source.size;
}

export async function resolveGuestGroup(slug: string): Promise<GuestGroupSettings> {
  const instance = firestore();
  const normalized = normalizeGuestSlug(slug);
  if (normalized !== slug) throw new Error('Dirección de invitados no válida.');
  const mapping = await getDoc(doc(instance, 'guestGroupSlugs', normalized));
  if (!mapping.exists() || mapping.data().active !== true) throw new Error('Este grupo de invitados no está disponible.');
  const groupId = String(mapping.data().groupId || '');
  if (!groupId) throw new Error('Este grupo de invitados no está disponible.');
  const config = await getDoc(doc(instance, 'guestGroups', groupId));
  if (!config.exists() || config.data().active !== true || config.data().slug !== normalized) {
    throw new Error('Este grupo de invitados no está disponible.');
  }
  return { groupId, ...config.data() } as GuestGroupSettings;
}

export async function listGuestPublications(groupId: string): Promise<GuestPublication[]> {
  const snapshot = await getDocs(collection(firestore(), 'guestGroups', groupId, 'publications'));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() } as GuestPublication));
}

export async function openGuestPublication(groupId: string, id: string): Promise<GuestPublication> {
  const snapshot = await getDoc(doc(firestore(), 'guestGroups', groupId, 'publications', id));
  if (!snapshot.exists()) throw new Error('La publicación invitada no existe o ya no está disponible.');
  return { id: snapshot.id, ...snapshot.data() } as GuestPublication;
}
