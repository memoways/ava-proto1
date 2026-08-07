import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExperienceArchitectureTab from "@/components/ExperienceArchitectureTab";

describe("ExperienceArchitectureTab", () => {
  it("explique l’architecture par flux et par composant", () => {
    render(<ExperienceArchitectureTab />);

    expect(screen.getByRole("heading", { name: /Comment l’expérience est construite/i })).toBeInTheDocument();
    expect(screen.getByText(/Supabase fourni et opéré par Lovable/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Contenu & RAG" }));

    expect(screen.getAllByText("Notion").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/La synchronisation admin transforme les pages en profils/i)).toBeInTheDocument();
    expect(screen.getByText("supabase/functions/sync-notion")).toBeInTheDocument();
  });

  it("permet de parcourir le chemin critique et la boucle asynchrone d’un tour", () => {
    render(<ExperienceArchitectureTab />);

    const turnTab = screen.getByRole("tab", { name: /Mécanique d’un tour/i });
    fireEvent.click(turnTab);
    expect(screen.getAllByText(/Pourquoi Ava ne vous faisait-elle plus confiance/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Après Max, le directeur part en parallèle/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Prompt → Max/i }));
    expect(screen.getByRole("heading", { name: "Faire répondre le personnage" })).toBeInTheDocument();
    expect(screen.getByText(/Produire une réponse incarnée/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Étape suivante" }));
    expect(screen.getByRole("heading", { name: "Restituer exactement la réponse" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Directeur post-tour/i }));
    expect(screen.getByText(/aucun deuxième appel LLM/i)).toBeInTheDocument();
    expect(screen.getByText(/ne bloque ni le texte ni la voix/i)).toBeInTheDocument();
  });
});
