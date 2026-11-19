/**
 * Real cases from the sandbox recette of 19 November 2026 (sessions 969600fd…, b6ba2c63…,
 * Max, overlay mode): the Max videos as stored in `video_triggers` (read-only copy, URLs
 * replaced) and the exchanges where a video was lost (timeout) or chosen on a first name alone.
 */
import type { VideoTriggerRow } from "@/services/videoTriggerService";

export const MAX_VIDEOS_20261119 = [
  {
    "id": "ff04c544-10e2-4e41-b445-bf4328d95b16",
    "title": "couteau",
    "type": "interlude",
    "priority": 1,
    "themes": [
      "famille",
      "patricarcat"
    ],
    "context": "Cette scène montre qu'en situation de stress, Max et Emma se replient sur un partage des tâches traditionnel et stéréotypé. Ils étaient pourtant convaincus d'avoir dépassé cela et d'avoir construit une relation plus équilibrée et égalitaire. Max se souvient ici qu'Emma l'a poussé dans le rôle de l'homme qui utilise une arme — le couteau — pour tuer un animal blessé. Dans leur idéal commun, Emma aurait dû s'en charger elle-même.",
    "description": "",
    "ai_description": "Une femme aux cheveux bruns attachés et un homme barbu aux cheveux gris sont dans une pièce sombre, éclairée par une lumière chaude. La femme porte un foulard à carreaux et une veste marron, l'homme une veste polaire bleue. La femme pose un couteau sur la table. L'homme sort de la maison enneigée,…",
    "video_url": "https://example.test/ff04c544-10e2-4e41-b445-bf4328d95b16.mp4"
  },
  {
    "id": "7519b936-6c67-42d3-90f1-0cec995bd18d",
    "title": "Emma regard feu avec Max",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "confiance",
      "secrets"
    ],
    "context": "Emma et Max proches, ensemble, mais séparés, chacun dans ses pensées; Emma se tourne vers le spectateur, comme si sent quelque chose, si elle comprend quelque chose",
    "description": "",
    "ai_description": "Deux personnes sont face à face, leurs fronts se touchent. Une femme aux cheveux foncés regarde l'autre personne, dont on ne voit que l'arrière de la tête. La lumière chaude d'un feu, visible en arrière-plan, éclaire leurs visages. L'ambiance est sombre et intime.",
    "video_url": "https://example.test/7519b936-6c67-42d3-90f1-0cec995bd18d.mp4"
  },
  {
    "id": "6b1d99e8-c024-4050-88b5-f94da1dd027e",
    "title": "mauvaise conscience",
    "type": "interlude",
    "priority": 1,
    "themes": [
      "trahison",
      "confiance"
    ],
    "context": "Dès le début de l'histoire, Max porte un secret lourd : il sait que son père a fait interner Mona dans un camp de quarantaine. Ce n'est pas ce qui avait été convenu entre Max et Emma, mais son père a craqué. Max n'a pas osé le dire à Emma, de peur que cela ne l'affecte trop. Il voulait la protéger — mais ce faisant, il l'infantilise, ce qui contredit leur idéal d'égalité. Max a mauvaise conscience et se fait du souci pour Mona. Il tente d'obtenir des informations sur les camps en discutant avec Philippe. Plus tard dans cette soirée arrosée, il finira par se confier à lui et lui parler de Mona.",
    "description": "",
    "ai_description": "Un homme barbu, aux cheveux longs, est assis dans une pièce sombre. Il regarde des photos sur un téléphone. Un autre homme, portant un chapeau, lui tend une bouteille et un verre. Le premier homme boit. L'ambiance est sombre et intime.",
    "video_url": "https://example.test/6b1d99e8-c024-4050-88b5-f94da1dd027e.mp4"
  },
  {
    "id": "deb68ed5-7f9d-4e3e-8c7e-ce2634a079b0",
    "title": "Max et Emma dans la nature",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "disparition",
      "confiance",
      "secrets"
    ],
    "context": "Max et Emma sont dehors sur le pâturage, un brouillard arrive, comme une menace",
    "description": "",
    "ai_description": "Un homme et une femme, d'âge mûr, sont debout en extérieur, devant une forêt de conifères. L'homme porte un pull à col roulé, la femme une veste matelassée. Ils regardent vers la droite, l'homme avec une expression pensive, la femme avec un air inquiet. De la fumée passe devant eux.",
    "video_url": "https://example.test/deb68ed5-7f9d-4e3e-8c7e-ce2634a079b0.mp4"
  },
  {
    "id": "640674ae-4875-46ee-803d-9dcf35bd381b",
    "title": "Max et Emma face à face tension",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "famille",
      "confiance",
      "secrets"
    ],
    "context": "Max et Emma sont dehors sur le pâturage, se font face, en silence, les mots sont bloqués, dire ou ne pas dire, protéger mais devant quoi ?",
    "description": "",
    "ai_description": "Un homme et une femme d'âge mûr se font face en extérieur. L'homme, barbu, porte une veste bleue et un pull foncé. La femme, aux cheveux gris attachés, porte une boucle d'oreille. Le fond est flou, vert et gris. La lumière est naturelle et diffuse.",
    "video_url": "https://example.test/640674ae-4875-46ee-803d-9dcf35bd381b.mp4"
  },
  {
    "id": "83df9675-3d2a-4ffb-abe2-cb3d5dc224ca",
    "title": "Max hésite avec son fusil",
    "type": "interlude",
    "priority": 1,
    "themes": [
      "patricarcat"
    ],
    "context": "Max hésite de poser son fusil, finalement il le garde",
    "description": "",
    "ai_description": "Un homme d'âge mûr, vêtu d'un pull sombre et d'un pantalon foncé, marche dans un paysage verdoyant. Il porte un fusil à l'épaule et un sac à la main. Il dépose le fusil sur un mur de pierres, puis le reprend et s'éloigne. L'ambiance est sombre et naturelle.",
    "video_url": "https://example.test/83df9675-3d2a-4ffb-abe2-cb3d5dc224ca.mp4"
  },
  {
    "id": "1c99c622-1513-4679-a879-d96b581f2597",
    "title": "Max lampe perdu dans la neige",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "disparition",
      "secrets"
    ],
    "context": "Max est sorti devant le chalet, dans la neige, il chercher quelque chose, ce n’est pas clair, peut-être que c’est dans sa tête qu’il cherche",
    "description": "",
    "ai_description": "Un homme aux cheveux roux, vêtu d'un blouson bleu et d'un jean, se tient dans la neige la nuit. Il tient une lanterne lumineuse dans une main et un couteau dans l'autre. Il tourne la tête et le corps de gauche à droite, comme s'il cherchait quelque chose. Il neige.",
    "video_url": "https://example.test/1c99c622-1513-4679-a879-d96b581f2597.mp4"
  },
  {
    "id": "97caab78-f01f-40a4-8a87-1c7925f332cb",
    "title": "Max pense avec Emma",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "confiance",
      "trahison"
    ],
    "context": "Max et Emma sont pris dans leurs pensées, perdus, on ne sait pas très bien s’ils sont encore bien connectés, tellement ils sont perdus et pris par ce qui leur arrive",
    "description": "",
    "ai_description": "Un homme barbu, au pull sombre, parle, le visage éclairé par une lumière chaude. Une femme aux cheveux attachés, vêtue de rouge et blanc, l'écoute en arrière-plan, dans la pénombre. L'ambiance est sombre et intime.",
    "video_url": "https://example.test/97caab78-f01f-40a4-8a87-1c7925f332cb.mp4"
  },
  {
    "id": "f4f86a7f-2308-415b-8e35-59d55d5a2aa8",
    "title": "Max perdu dans ses pensees feu de cheminee",
    "type": "interlude",
    "priority": 1,
    "themes": [
      "famille",
      "secrets",
      "trahison"
    ],
    "context": "Max est perdu dans ses pensées, devant le feu de cheminée",
    "description": "",
    "ai_description": "Un homme d'âge mûr, aux cheveux et à la barbe poivre et sel, porte un pull à col roulé sombre. Il est vu de profil, le regard baissé, la bouche légèrement ouverte. La lumière est tamisée, créant une ambiance intime et sombre.",
    "video_url": "https://example.test/f4f86a7f-2308-415b-8e35-59d55d5a2aa8.mp4"
  },
  {
    "id": "2e4759ac-962f-4794-936f-a22eb4293f04",
    "title": "Max pris dans le brouillard",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "disparition",
      "secrets"
    ],
    "context": "Max est attaqué par un intense brouillard - il n’y a plus de moyens d’échapper à ce qui va advenir, juste à se laisser envelopper",
    "description": "",
    "ai_description": "Un homme aux cheveux bruns, de dos, en pull bleu foncé, se tient devant une petite bâtisse. Il regarde un champ brumeux où de la fumée blanche s'échappe du sol. La brume s'épaissit et l'homme disparaît.",
    "video_url": "https://example.test/2e4759ac-962f-4794-936f-a22eb4293f04.mp4"
  },
  {
    "id": "2ae41e43-0439-44ad-806e-32f6682d9c66",
    "title": "Max s'effondre fin du film",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "Contamination"
    ],
    "context": "Max sait qu’il a perdu toutes les femmes de sa famille, qui sont maintenant tous en train de devenir des hommes",
    "description": "",
    "ai_description": "Un homme aux cheveux grisonnants, vêtu d'un pull sombre, est accroupi sur l'herbe et se cache le visage avec ses mains. À droite, une main tient un bâton. L'ambiance est sombre, la lumière est diffuse.",
    "video_url": "https://example.test/2ae41e43-0439-44ad-806e-32f6682d9c66.mp4"
  },
  {
    "id": "4be90e1a-b82e-494b-a98d-eddaaeeb4e20",
    "title": "Max, Emma et Leo suspendus, tension",
    "type": "mid_conversation",
    "priority": 1,
    "themes": [
      "Contamination",
      "pandémie"
    ],
    "context": "Ava arrive depuis la forêt, devenu un garçon: Max sait que Ava va contaminer Emma, et que sa femme va devenir un homme…",
    "description": "",
    "ai_description": "Un homme barbu tient un fusil, une femme et un adolescent sont à ses côtés. Ils regardent tous les trois vers la droite de l'écran, l'air inquiet. Le décor est un paysage de montagne avec des arbres et de l'herbe. La lumière est naturelle et l'ambiance visuelle est sombre.",
    "video_url": "https://example.test/4be90e1a-b82e-494b-a98d-eddaaeeb4e20.mp4"
  },
  {
    "id": "0cd1112b-1bca-4fc3-8199-370e52b448e7",
    "title": "mort Peter",
    "type": "interlude",
    "priority": 1,
    "themes": [
      "secrets",
      "pandémie"
    ],
    "context": "La mort de Peter — qui s'avère bien plus tard être Lise — est certes un accident. Mais c'est un moment de bascule important, qui ouvre en quelque sorte la possibilité de la mise à mort dans ce contexte. Et Max y est pour quelque chose. Était-il vraiment nécessaire d'attacher Peter sous cet abri ? Il aurait pu aller vérifier le chalet voisin en l'emmenant avec lui.",
    "description": "",
    "ai_description": "Un homme barbu, aux cheveux longs, vêtu d'un pull à col roulé et d'un pantalon sombres, marche dans un champ d'herbe verte avec un fusil sur l'épaule. Il découvre un corps sous une tôle et le recouvre de paille. La lumière est naturelle et l'ambiance visuelle est sombre.",
    "video_url": "https://example.test/0cd1112b-1bca-4fc3-8199-370e52b448e7.mp4"
  },
  {
    "id": "2fe70ec6-d488-4f9f-a08a-35c72016081c",
    "title": "test slowly-turning-on-himself",
    "type": "interlude",
    "priority": 1,
    "themes": [
      "disparition"
    ],
    "context": "Max est dehors devant le chalet, sous la neige: il est comme perdu, cherche un indice, halluciné, éclairant la neige mais ne voit rien",
    "description": "",
    "ai_description": "Un homme aux cheveux roux, vêtu d'un sweat bleu et d'un jean, se tient dans la neige la nuit. Il tient une lanterne allumée dans une main et un objet sombre dans l'autre, et regarde autour de lui. La neige tombe.",
    "video_url": "https://example.test/2fe70ec6-d488-4f9f-a08a-35c72016081c.mp4"
  }
] as unknown as VideoTriggerRow[];

export const MORT_PETER_ID = "0cd1112b-1bca-4fc3-8199-370e52b448e7";
export const EMMA_FEU_ID = "7519b936-6c67-42d3-90f1-0cec995bd18d";

/** Turn 5 of b6ba2c63: selection timed out although « mort Peter » matches the reply. */
export const FUSIL_TURN = {
  userMessage: "Mais avec le fusil par exemple, tu as fait quoi",
  replyText: "J’ai pris le fusil et j’ai tiré sur l’homme que j’avais ligoté, parce que je croyais devoir protéger les miens. Il est mort dans l’abri qui s’effondrait, et je ne peux pas transformer ça en nécessité pour me pardonner. J’aurais dû empêcher cette situation… et je l’ai quand même créée.",
};

/** Turn 6 of b6ba2c63: « Emma regard feu avec Max » was shown on the first name at the end of the reply. */
export const EMMA_TURN = {
  userMessage: "C'est toi qui est fautif donc.",
  replyText: "Oui. Pour sa mort, je suis fautif : je l’ai ligoté, et j’ai créé la situation où le fusil est devenu possible. Ça ne rend pas les autres morts de ma faute, mais celle-là, je ne peux pas la repousser sur la panique ou sur la pandémie. Je devrai vivre avec ce que j’ai fait… et avec ce que ça fera à Emma.",
  /** What the selector answered then (confidence 0.7, reason on the name). */
  recordedAnswer: '{"videoId":"7519b936-6c67-42d3-90f1-0cec995bd18d","confidence":0.7,"replyCue":"avec ce que ça fera à Emma","videoCue":"Emma et Max proches"}',
};

export const RECENT_LOG_BEFORE_EMMA_TURN = [
  { role: "user", content: "Tu choisis quoi" },
  { role: "max", content: "Je choisis de rester avec Emma et de ne plus décider à sa place. Je lui dirai ce que je sais, même si ça ne répare rien." },
  { role: "user", content: FUSIL_TURN.userMessage },
  { role: "max", content: FUSIL_TURN.replyText },
  { role: "user", content: EMMA_TURN.userMessage },
];
