/**
 * Couche d'abstraction IA.
 *
 * Le metier ne connait jamais le fournisseur : il appelle `completer()`.
 * Changer de fournisseur = changer AI_PROVIDER dans l'environnement.
 *
 * Le fournisseur `local` n'appelle aucune API : il restitue les faits calcules
 * par le moteur metier sous forme de texte. L'application reste donc
 * pleinement fonctionnelle sans cle d'API, et les reponses restent verifiables.
 */

export type MessageIa = {
  role: "user" | "assistant"
  contenu: string
}

export type DemandeCompletion = {
  systeme: string
  messages: MessageIa[]
  /** Texte de repli utilise par le fournisseur local ou en cas d'echec API */
  repli: string
  maxTokens?: number
}

export interface FournisseurIa {
  readonly nom: string
  readonly disponible: boolean
  completer(demande: DemandeCompletion): Promise<string>
}

class FournisseurLocal implements FournisseurIa {
  readonly nom = "local"
  readonly disponible = true

  async completer(demande: DemandeCompletion): Promise<string> {
    return demande.repli
  }
}

class FournisseurAnthropic implements FournisseurIa {
  readonly nom = "anthropic"

  constructor(
    private readonly cle: string,
    private readonly modele: string
  ) {}

  get disponible(): boolean {
    return this.cle.length > 0
  }

  async completer(demande: DemandeCompletion): Promise<string> {
    if (!this.disponible) return demande.repli

    try {
      const reponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.cle,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.modele,
          max_tokens: demande.maxTokens ?? 1200,
          system: demande.systeme,
          messages: demande.messages.map((m) => ({ role: m.role, content: m.contenu })),
        }),
        signal: AbortSignal.timeout(45_000),
      })

      if (!reponse.ok) {
        console.warn(`[ia] anthropic ${reponse.status} : repli sur le moteur local`)
        return demande.repli
      }

      const donnees = (await reponse.json()) as { content?: { type: string; text?: string }[] }
      const texte = (donnees.content ?? [])
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("\n")
        .trim()

      return texte.length > 0 ? texte : demande.repli
    } catch (erreur) {
      console.warn("[ia] appel anthropic impossible, repli sur le moteur local", erreur)
      return demande.repli
    }
  }
}

class FournisseurOpenAi implements FournisseurIa {
  readonly nom = "openai"

  constructor(
    private readonly cle: string,
    private readonly modele: string
  ) {}

  get disponible(): boolean {
    return this.cle.length > 0
  }

  async completer(demande: DemandeCompletion): Promise<string> {
    if (!this.disponible) return demande.repli

    try {
      const reponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.cle}`,
        },
        body: JSON.stringify({
          model: this.modele,
          max_tokens: demande.maxTokens ?? 1200,
          messages: [
            { role: "system", content: demande.systeme },
            ...demande.messages.map((m) => ({ role: m.role, content: m.contenu })),
          ],
        }),
        signal: AbortSignal.timeout(45_000),
      })

      if (!reponse.ok) {
        console.warn(`[ia] openai ${reponse.status} : repli sur le moteur local`)
        return demande.repli
      }

      const donnees = (await reponse.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      const texte = donnees.choices?.[0]?.message?.content?.trim() ?? ""
      return texte.length > 0 ? texte : demande.repli
    } catch (erreur) {
      console.warn("[ia] appel openai impossible, repli sur le moteur local", erreur)
      return demande.repli
    }
  }
}

let instance: FournisseurIa | null = null

export function fournisseurIa(): FournisseurIa {
  if (instance) return instance

  const choix = (process.env.AI_PROVIDER ?? "local").toLowerCase()
  const modele = process.env.AI_MODEL ?? "claude-sonnet-5"

  if (choix === "anthropic") {
    const f = new FournisseurAnthropic(process.env.ANTHROPIC_API_KEY ?? "", modele)
    instance = f.disponible ? f : new FournisseurLocal()
  } else if (choix === "openai") {
    const f = new FournisseurOpenAi(process.env.OPENAI_API_KEY ?? "", modele)
    instance = f.disponible ? f : new FournisseurLocal()
  } else {
    instance = new FournisseurLocal()
  }

  return instance
}

export const SYSTEME_METIER = `Tu es l'assistant metier d'une societe de coordination de travaux BTP.
Tu raisonnes uniquement a partir des donnees chiffrees qui te sont fournies : ne jamais inventer
un montant, une date ou un nom d'entreprise absent du contexte.
Reponds en francais, de maniere factuelle et concise, en citant les montants en euros HT.
Quand une donnee manque pour repondre, dis-le explicitement plutot que d'extrapoler.`
