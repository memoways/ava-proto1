import { describe, expect, it } from "vitest";
import {
  buildTurnRelationshipDirective,
  compileCharacterRelationshipPolicy,
  createInitialRelationshipState,
  validateRelationshipTransition,
} from "@/services/relationshipEngine";

const source = {
  updated_at: "2026-09-11T10:00:00Z",
  dynamique_conversation: "Comprendre ce que l'interlocuteur vient chercher.",
  sujets_sensibles: "Le fusil\nEmma",
  profondeur_par_niveau: "Niveau 1 : faits extérieurs. Niveau 2 : premières fissures. Niveau 3 : vérité.",
  politique_relationnelle: [
    "Moteur",
    "Comprendre pourquoi cette personne appelle sans présumer un lien.",
    "",
    "Signes d’ouverture",
    "- écoute précise",
    "- respect d'une limite",
    "- confrontation pertinente",
    "",
    "Signes de fermeture",
    "- insistance après une limite",
    "- hostilité",
    "",
    "Sujets sensibles",
    "- Le fusil :: confiance :: après une relation construite",
    "- Emma :: lien :: si la question respecte sa place",
    "",
    "Résistance",
    "Répondre partiellement, déplacer le sujet ou questionner l'intention.",
    "",
    "Initiative",
    "Reprendre un fil qui compte pour lui, sans question réflexe.",
  ].join("\n"),
};

describe("relationship engine", () => {
  it("retient une question intime immédiate même si le RAG connaît le fait", () => {
    const policy = compileCharacterRelationshipPolicy(source, "max");
    const state = createInitialRelationshipState("max", policy.version);
    const directive = buildTurnRelationshipDirective({
      policy,
      state,
      userMessage: "Pourquoi as-tu levé le fusil sur Emma ?",
    });

    expect(directive.mode).toBe("resist");
    expect(directive.matchedTopicIds).toContain("le-fusil");
    expect(directive.prompt).toMatch(/RAG fournit des faits, jamais une autorisation/i);
    expect(directive.prompt).toMatch(/répondre partiellement/i);
  });

  it("n'avance pas sur la seule politesse ou sur une confidence trop précoce du personnage", () => {
    const policy = compileCharacterRelationshipPolicy(source, "max");
    const previous = createInitialRelationshipState("max", policy.version);

    for (const evidence of ["politeness", "character_disclosure"] as const) {
      const audit = validateRelationshipTransition({
        previous,
        policy,
        characterKey: "max",
        turnIndex: 1,
        proposal: {
          tier: "link",
          evidence: [evidence],
          justification: "Le personnage a beaucoup parlé.",
          sourceTurn: 1,
          characterKey: "max",
          policyVersion: policy.version,
        },
      });
      expect(audit.accepted).toBe(false);
      expect(audit.reasons).toContain("upward_without_user_evidence");
    }
  });

  it("accepte une ouverture gagnée, une fermeture après pression et une réparation", () => {
    const policy = compileCharacterRelationshipPolicy(source, "max");
    const contact = createInitialRelationshipState("max", policy.version);
    const linked = validateRelationshipTransition({
      previous: contact,
      policy,
      characterKey: "max",
      turnIndex: 2,
      proposal: {
        tier: "link",
        topicOpenness: { emma: "partial" },
        evidence: ["boundary_respected", "precise_listening"],
        justification: "L'interlocuteur a respecté le refus puis repris un détail précis.",
        sourceTurn: 2,
        characterKey: "max",
        policyVersion: policy.version,
      },
    });
    expect(linked.accepted).toBe(true);
    expect(linked.next.tier).toBe("link");

    const closed = validateRelationshipTransition({
      previous: linked.next,
      policy,
      characterKey: "max",
      turnIndex: 3,
      proposal: {
        tier: "contact",
        evidence: ["boundary_pressure"],
        justification: "L'interlocuteur insiste après une limite.",
        sourceTurn: 3,
        characterKey: "max",
        policyVersion: policy.version,
      },
    });
    expect(closed.accepted).toBe(true);
    expect(closed.next.tier).toBe("contact");

    const repaired = validateRelationshipTransition({
      previous: closed.next,
      policy,
      characterKey: "max",
      turnIndex: 4,
      proposal: {
        tier: "link",
        evidence: ["repair"],
        justification: "L'interlocuteur reconnaît l'insistance et répare.",
        sourceTurn: 4,
        characterKey: "max",
        policyVersion: policy.version,
      },
    });
    expect(repaired.accepted).toBe(true);
  });

  it("refuse les mises à jour périmées, d'une autre version ou d'un autre personnage", () => {
    const policy = compileCharacterRelationshipPolicy(source, "emma");
    const previous = { ...createInitialRelationshipState("emma", policy.version), sourceTurn: 5 };
    const audit = validateRelationshipTransition({
      previous,
      policy,
      characterKey: "emma",
      turnIndex: 5,
      proposal: {
        tier: "link",
        evidence: ["honesty"],
        sourceTurn: 4,
        characterKey: "max",
        policyVersion: "obsolete",
      },
    });

    expect(audit.accepted).toBe(false);
    expect(audit.reasons).toEqual(expect.arrayContaining([
      "character_mismatch",
      "policy_version_mismatch",
      "source_turn_mismatch",
      "stale_turn",
    ]));
  });

  it("fonctionne pour un troisième personnage sans branche spécifique", () => {
    const policy = compileCharacterRelationshipPolicy(source, "sam");
    const directive = buildTurnRelationshipDirective({
      policy,
      state: createInitialRelationshipState("sam", policy.version),
      userMessage: "Parle-moi d'Emma.",
    });

    expect(policy.characterKey).toBe("sam");
    expect(directive.characterKey).toBe("sam");
    expect(directive.mode).toBe("resist");
  });
});
