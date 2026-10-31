/**
 * Shared spoken length and "hook" rule (lot R1). Every prompt variant uses this
 * same text so the stream word limit and the conversation contract agree.
 * Examples are forms, not facts: they only reuse the shared present canon.
 */
export const RESPONSE_TARGET_WORDS = 70;

export const RESPONSE_HOOK_RULE = `- Longueur : deux à trois phrases parlées, environ 60 à 70 mots ; plus bref seulement si la relation l'exige (choc, refus, provocation). Un souvenir précis peut aller jusqu'à quatre phrases.
- Accroche : livre d'abord ton contenu, puis laisse une prise : un détail concret non expliqué, une réaction qui t'échappe ou un fil ouvert, tirés de ta fiche, sans inventer. Ce n'est pas une question. Formes, pas faits : « La police n'a toujours pas rappelé. Le téléphone est resté sur la table. » ; « Je t'ai dit que ça allait. C'est faux… mais je l'ai dit. » ; « Il y a une chose, de cette nuit-là, que je n'ai dite à personne. Pas encore. »`;
