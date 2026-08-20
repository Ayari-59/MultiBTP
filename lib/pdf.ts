// Module serveur uniquement : ne jamais importer depuis un composant client.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

/**
 * Generateur de documents PDF (devis, consultations, marches, rapports).
 *
 * Volontairement minimal : une pile de blocs (titre, paragraphe, tableau,
 * totaux) posee sur des pages A4 avec saut automatique. Aucune dependance de
 * mise en page lourde, et le rendu reste identique cote serveur.
 */

const A4 = { largeur: 595.28, hauteur: 841.89 }
const MARGE = 42
const ARDOISE = rgb(0.075, 0.122, 0.176)
const GRIS = rgb(0.36, 0.42, 0.49)
const GRIS_CLAIR = rgb(0.9, 0.92, 0.94)
const CHANTIER = rgb(0.976, 0.525, 0.059)

export type Colonne = {
  titre: string
  largeur: number
  aligne?: "gauche" | "droite"
}

export type Bloc =
  | { type: "titre"; texte: string }
  | { type: "sousTitre"; texte: string }
  | { type: "paragraphe"; texte: string }
  | { type: "espace"; hauteur?: number }
  | { type: "separateur" }
  | { type: "champs"; valeurs: [string, string][] }
  | { type: "tableau"; colonnes: Colonne[]; lignes: string[][] }
  | { type: "totaux"; valeurs: [string, string][]; accent?: boolean }

export type DocumentPdf = {
  titre: string
  sousTitre?: string
  organisation: {
    nom: string
    adresse?: string | null
    codePostal?: string | null
    ville?: string | null
    telephone?: string | null
    email?: string | null
    siret?: string | null
  }
  reference?: string
  blocs: Bloc[]
}

/** WinAnsi ne couvre pas tous les caracteres : on neutralise le reste. */
function assainir(texte: string): string {
  return texte
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/€/g, "EUR")
    .replace(/[^\x20-\xFF\n]/g, "")
}

function couper(texte: string, font: PDFFont, taille: number, largeur: number): string[] {
  const mots = assainir(texte).split(/\s+/)
  const lignes: string[] = []
  let courante = ""

  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot
    if (font.widthOfTextAtSize(essai, taille) > largeur && courante) {
      lignes.push(courante)
      courante = mot
    } else {
      courante = essai
    }
  }
  if (courante) lignes.push(courante)
  return lignes
}

export async function genererPdf(doc: DocumentPdf): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const regulier = await pdf.embedFont(StandardFonts.Helvetica)
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold)

  const largeurUtile = A4.largeur - MARGE * 2
  let page: PDFPage = pdf.addPage([A4.largeur, A4.hauteur])
  let y = A4.hauteur - MARGE

  function nouvellePage() {
    page = pdf.addPage([A4.largeur, A4.hauteur])
    y = A4.hauteur - MARGE
  }

  function place(hauteur: number) {
    if (y - hauteur < MARGE + 30) nouvellePage()
  }

  function ecrire(
    texte: string,
    options: { x?: number; taille?: number; font?: PDFFont; couleur?: ReturnType<typeof rgb> } = {}
  ) {
    page.drawText(assainir(texte), {
      x: options.x ?? MARGE,
      y,
      size: options.taille ?? 9,
      font: options.font ?? regulier,
      color: options.couleur ?? ARDOISE,
    })
  }

  // ─── En-tete ──────────────────────────────────────────────────────────────
  page.drawRectangle({
    x: 0,
    y: A4.hauteur - 6,
    width: A4.largeur,
    height: 6,
    color: CHANTIER,
  })

  y -= 6
  ecrire(doc.organisation.nom, { taille: 13, font: gras })
  y -= 13

  const coordonnees = [
    [doc.organisation.adresse, doc.organisation.codePostal, doc.organisation.ville]
      .filter(Boolean)
      .join(" "),
    [doc.organisation.telephone, doc.organisation.email].filter(Boolean).join(" · "),
    doc.organisation.siret ? `SIRET ${doc.organisation.siret}` : "",
  ].filter(Boolean)

  for (const ligne of coordonnees) {
    ecrire(ligne, { taille: 7.5, couleur: GRIS })
    y -= 9
  }

  if (doc.reference) {
    const largeurRef = gras.widthOfTextAtSize(assainir(doc.reference), 9)
    page.drawText(assainir(doc.reference), {
      x: A4.largeur - MARGE - largeurRef,
      y: A4.hauteur - MARGE - 6,
      size: 9,
      font: gras,
      color: GRIS,
    })
  }

  y -= 14
  page.drawLine({
    start: { x: MARGE, y },
    end: { x: A4.largeur - MARGE, y },
    thickness: 0.7,
    color: GRIS_CLAIR,
  })
  y -= 22

  ecrire(doc.titre, { taille: 16, font: gras })
  y -= 18
  if (doc.sousTitre) {
    ecrire(doc.sousTitre, { taille: 9, couleur: GRIS })
    y -= 14
  }
  y -= 8

  // ─── Blocs ────────────────────────────────────────────────────────────────
  for (const bloc of doc.blocs) {
    switch (bloc.type) {
      case "titre": {
        place(28)
        y -= 6
        ecrire(bloc.texte, { taille: 12, font: gras })
        y -= 16
        break
      }

      case "sousTitre": {
        place(20)
        ecrire(bloc.texte, { taille: 9.5, font: gras })
        y -= 14
        break
      }

      case "paragraphe": {
        const lignes = couper(bloc.texte, regulier, 9, largeurUtile)
        for (const ligne of lignes) {
          place(12)
          ecrire(ligne, { taille: 9 })
          y -= 12
        }
        y -= 4
        break
      }

      case "espace":
        y -= bloc.hauteur ?? 10
        break

      case "separateur": {
        place(12)
        page.drawLine({
          start: { x: MARGE, y },
          end: { x: A4.largeur - MARGE, y },
          thickness: 0.5,
          color: GRIS_CLAIR,
        })
        y -= 12
        break
      }

      case "champs": {
        for (const [libelle, valeur] of bloc.valeurs) {
          place(13)
          ecrire(libelle, { taille: 8, couleur: GRIS })
          ecrire(valeur, { x: MARGE + 140, taille: 9, font: gras })
          y -= 13
        }
        y -= 4
        break
      }

      case "tableau": {
        const total = bloc.colonnes.reduce((s, c) => s + c.largeur, 0)
        const facteur = largeurUtile / total

        place(24)
        page.drawRectangle({
          x: MARGE,
          y: y - 4,
          width: largeurUtile,
          height: 16,
          color: rgb(0.96, 0.97, 0.98),
        })

        let x = MARGE + 4
        for (const colonne of bloc.colonnes) {
          const largeur = colonne.largeur * facteur
          const texte = assainir(colonne.titre)
          const decalage =
            colonne.aligne === "droite"
              ? largeur - 8 - gras.widthOfTextAtSize(texte, 7.5)
              : 0
          page.drawText(texte, {
            x: x + decalage,
            y: y + 1,
            size: 7.5,
            font: gras,
            color: GRIS,
          })
          x += largeur
        }
        y -= 20

        for (const ligne of bloc.lignes) {
          place(15)
          let colonneX = MARGE + 4
          for (const [i, colonne] of bloc.colonnes.entries()) {
            const largeur = colonne.largeur * facteur
            const brut = assainir(ligne[i] ?? "")
            // Tronque plutot que de deborder sur la colonne voisine.
            let texte = brut
            while (texte.length > 1 && regulier.widthOfTextAtSize(texte, 8) > largeur - 8) {
              texte = texte.slice(0, -1)
            }
            if (texte !== brut && texte.length > 1) texte = `${texte.slice(0, -1)}.`

            const decalage =
              colonne.aligne === "droite"
                ? largeur - 8 - regulier.widthOfTextAtSize(texte, 8)
                : 0
            page.drawText(texte, {
              x: colonneX + decalage,
              y,
              size: 8,
              font: regulier,
              color: ARDOISE,
            })
            colonneX += largeur
          }
          y -= 6
          page.drawLine({
            start: { x: MARGE, y },
            end: { x: A4.largeur - MARGE, y },
            thickness: 0.3,
            color: GRIS_CLAIR,
          })
          y -= 9
        }
        y -= 6
        break
      }

      case "totaux": {
        for (const [libelle, valeur] of bloc.valeurs) {
          place(15)
          const font = bloc.accent ? gras : regulier
          const largeurValeur = font.widthOfTextAtSize(assainir(valeur), 9.5)
          ecrire(libelle, { x: A4.largeur - MARGE - 200, taille: 9, couleur: GRIS })
          page.drawText(assainir(valeur), {
            x: A4.largeur - MARGE - largeurValeur,
            y,
            size: 9.5,
            font,
            color: ARDOISE,
          })
          y -= 14
        }
        y -= 4
        break
      }
    }
  }

  // ─── Pied de page ─────────────────────────────────────────────────────────
  const pages = pdf.getPages()
  pages.forEach((p, i) => {
    p.drawText(
      assainir(
        `${doc.organisation.nom} — ${doc.titre} — page ${i + 1}/${pages.length} — edite le ${new Date().toLocaleDateString("fr-FR")}`
      ),
      { x: MARGE, y: 24, size: 7, font: regulier, color: GRIS }
    )
  })

  return pdf.save()
}
