/**
 * Shared spoken length and "hook" rule (lot R1). Every prompt variant uses this
 * same text so the stream word limit and the conversation contract agree.
 * Examples are templates, not quotable lines: concrete sample props were copied
 * verbatim into most replies during the R1 sandbox proof. G1: the hook is a thread
 * of the character's drama, never a domestic detail (Max drifted into the coffee).
 */
export const RESPONSE_TARGET_WORDS = 70;

export const RESPONSE_HOOK_RULE = `- Longueur : deux à trois phrases parlées, autour de 60 mots ; plus bref seulement si la relation l'exige (choc, refus, provocation). Un souvenir précis peut aller jusqu'à quatre phrases.
- Accroche : livre d'abord ton contenu, puis laisse une prise : un fil de ton drame laissé ouvert (Ava, ce que tu as fait, ce qui attend ta famille, une peur), une réaction qui t'échappe, tirés de ta fiche, sans inventer. Ce n'est pas une question, ni un détail du décor ou du quotidien. Gabarits, à remplir avec ta fiche : « [ce que tu réponds]. Et [un moment lourd de ta fiche]… je n'arrive pas à le dire. » ; « [ce que tu as dit]. C'est faux… mais je l'ai dit. » ; « Il y a autre chose, sur [un moment de ta fiche]. Pas maintenant. » Varie l'accroche : ne reprends pas un fil ou une image déjà donnés dans l'appel.`;
