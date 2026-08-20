import type { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { requireAccess } from "@/lib/session"
import { fournisseurIa } from "@/lib/ia/provider"
import { QUESTIONS_SUGGEREES } from "@/lib/ia/assistant"
import { Carte, CorpsCarte, EnteteCarte } from "@/components/ui/primitives"
import { Conversation } from "./conversation"
import { dateCourte } from "@/lib/utils"

export const metadata: Metadata = { title: "Assistant metier" }

export default async function PageAssistant() {
  const utilisateur = await requireAccess("assistant", "read")

  const [projets, historique] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId: utilisateur.organizationId,
        statut: { notIn: ["ARCHIVE"] },
      },
      select: { id: true, nom: true, reference: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.aiMessage.findMany({
      where: {
        conversation: {
          organizationId: utilisateur.organizationId,
          userId: utilisateur.id,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, role: true, contenu: true, createdAt: true, fournisseur: true },
    }),
  ])

  const fournisseur = fournisseurIa().nom

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-ardoise-900">Assistant metier</h1>
        <p className="text-sm text-ardoise-500">
          Il repond a partir de vos donnees reelles : chiffrages, marches, engagements, factures,
          planning. Aucun chiffre n&apos;est invente.
        </p>
      </div>

      <Conversation
        projets={projets.map((p) => ({ id: p.id, libelle: `${p.reference} — ${p.nom}` }))}
        suggestions={QUESTIONS_SUGGEREES}
        fournisseur={fournisseur}
      />

      {historique.length > 0 && (
        <Carte>
          <EnteteCarte
            titre="Historique"
            description={`${historique.length} dernier(s) echange(s)`}
          />
          <ul className="divide-y divide-ardoise-100">
            {[...historique].reverse().map((m) => (
              <li key={m.id} className="px-4 py-3">
                <p className="text-[11px] text-ardoise-400">
                  {m.role === "user" ? "Vous" : `Assistant (${m.fournisseur ?? "local"})`} ·{" "}
                  {dateCourte(m.createdAt)}
                </p>
                <p
                  className={
                    m.role === "user"
                      ? "mt-0.5 text-sm font-medium text-ardoise-900"
                      : "mt-0.5 whitespace-pre-line text-sm leading-relaxed text-ardoise-700"
                  }
                >
                  {m.contenu}
                </p>
              </li>
            ))}
          </ul>
        </Carte>
      )}

      <Carte>
        <EnteteCarte titre="Comment fonctionne l'assistant" />
        <CorpsCarte className="space-y-2 text-xs leading-relaxed text-ardoise-600">
          <p>
            Les questions frequentes (couts engages, devis en attente, baisse de marge, risques de
            retard) sont traitees par des requetes exactes sur la base : la reponse est un chiffre
            verifiable, pas une estimation.
          </p>
          <p>
            Pour les questions libres, un resume factuel de vos projets est transmis au fournisseur
            configure ({fournisseur}), avec consigne stricte de ne rien extrapoler. Le fournisseur
            se change dans la variable d&apos;environnement <code className="rounded bg-ardoise-100 px-1">AI_PROVIDER</code>{" "}
            sans toucher au reste de l&apos;application.
          </p>
          <p>
            En mode <code className="rounded bg-ardoise-100 px-1">local</code>, aucune donnee ne sort
            de votre infrastructure : les reponses sont produites par le moteur de calcul interne.
          </p>
        </CorpsCarte>
      </Carte>
    </div>
  )
}
