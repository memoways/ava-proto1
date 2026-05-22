/** PRD4 — Écran 3 : Teaser / rappel placeholder */
import { Button } from "@/components/ui/button";

interface Props {
  onContinue: () => void;
  onSkip: () => void;
}

const TEASER_PARAGRAPHS = [
  `Bienvenue dans l'expérience interactive du film Où est Ava ?`,
  `Le film suit une famille ordinaire — Max, Emma, et leurs deux enfants Ava et Léo — qui se réfugie dans un chalet d'alpage pour fuir une pandémie hors du commun : un virus qui transforme les femmes en hommes. Un phénomène que l'on appelle la protogynie.`,
  `Face à l'inconnu, Max et Emma tentent de protéger ce qu'ils ont — leur famille, leur équilibre, leur identité. Mais cette peur de perdre, imperceptiblement, les transforme. Les vieilles structures du patriarcat refont surface. L'inhumain s'installe sans qu'on le voie vraiment venir.`,
  `Ava et Léo, eux, semblent regarder le monde autrement. Une lueur fragile — peut-être la seule.`,
  `Le séjour à la montagne s'est achevé dans l'horreur. Plusieurs morts. Et un retour en ville chargé de silence. Emma et Ava sont désormais contaminées. Dans quelques jours, elles deviendront à leur tour des protogynes.`,
];

const TeaserScreen = ({ onContinue, onSkip }: Props) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12">
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <div className="rounded-md border border-border bg-muted/40 px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground">
        Placeholder&nbsp;: cette séquence sera remplacée par une vidéo d'introduction.
      </div>

      <article className="space-y-5 font-serif text-lg leading-relaxed text-foreground/90 md:text-xl">
        {TEASER_PARAGRAPHS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </article>

      <div className="flex flex-col items-center justify-center gap-3 pt-4 sm:flex-row">
        <Button variant="ghost" onClick={onSkip} className="min-w-[140px]">
          Passer
        </Button>
        <Button onClick={onContinue} className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90">
          Continuer
        </Button>
      </div>
    </div>
  </div>
);

export default TeaserScreen;
