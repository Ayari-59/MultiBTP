// Module serveur uniquement : ne jamais importer depuis un composant client.
import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises"
import path from "node:path"

/**
 * Abstraction de stockage des fichiers.
 *
 * Le pilote `local` ecrit dans un dossier hors de `public/` : les fichiers ne
 * sont jamais servis en statique, ils passent par une route protegee qui
 * verifie l'appartenance du document a l'organisation de l'utilisateur.
 * Brancher S3, Supabase Storage ou Azure Blob revient a implementer les trois
 * fonctions de ce module.
 */

const TAILLE_MAX = 25 * 1024 * 1024 // 25 Mo

const TYPES_AUTORISES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/msword",
  "text/csv",
  "text/plain",
  "application/zip",
  "application/x-zip-compressed",
  "image/vnd.dwg",
  "application/acad",
])

export type FichierEnregistre = {
  chemin: string
  url: string
  nom: string
  mimeType: string
  taille: number
}

function racine(): string {
  return path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "storage/uploads")
}

/** Empeche toute remontee de repertoire dans un chemin fourni par le client. */
function cheminSur(chemin: string): string {
  const absolu = path.resolve(racine(), chemin)
  if (!absolu.startsWith(racine() + path.sep) && absolu !== racine()) {
    throw new Error("Chemin de fichier invalide.")
  }
  return absolu
}

function extensionSure(nom: string): string {
  const ext = path.extname(nom).toLowerCase()
  return /^\.[a-z0-9]{1,6}$/.test(ext) ? ext : ""
}

export async function enregistrerFichier(
  fichier: File,
  organizationId: string,
  sousDossier = "documents"
): Promise<FichierEnregistre> {
  if (fichier.size === 0) throw new Error("Fichier vide.")
  if (fichier.size > TAILLE_MAX) {
    throw new Error(`Fichier trop volumineux (maximum ${TAILLE_MAX / 1024 / 1024} Mo).`)
  }
  if (fichier.type && !TYPES_AUTORISES.has(fichier.type)) {
    throw new Error(`Type de fichier non autorise : ${fichier.type}.`)
  }

  // Le nom stocke est aleatoire : le nom d'origine reste en base uniquement.
  const nomStocke = `${randomUUID()}${extensionSure(fichier.name)}`
  const relatif = path.posix.join(organizationId, sousDossier, nomStocke)
  const absolu = cheminSur(relatif)

  await mkdir(path.dirname(absolu), { recursive: true })
  await writeFile(absolu, Buffer.from(await fichier.arrayBuffer()))

  return {
    chemin: relatif,
    url: `/api/fichiers/${relatif}`,
    nom: fichier.name,
    mimeType: fichier.type || "application/octet-stream",
    taille: fichier.size,
  }
}

export async function lireFichier(chemin: string): Promise<Buffer> {
  return readFile(cheminSur(chemin))
}

export async function supprimerFichier(chemin: string): Promise<void> {
  try {
    await unlink(cheminSur(chemin))
  } catch {
    // Le fichier a deja disparu : la suppression logique en base fait foi.
  }
}

/** Empreinte utilisee pour detecter les doublons de versement. */
export function empreinte(contenu: Buffer): string {
  return createHash("sha256").update(contenu).digest("hex").slice(0, 16)
}
