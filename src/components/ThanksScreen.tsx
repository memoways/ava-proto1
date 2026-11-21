const ThanksScreen = ({
  onRestart,
  newsletterRequested = false,
}: {
  onRestart: () => void;
  newsletterRequested?: boolean;
}) => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background animate-fade-in">
      <div className="cinema-gradient absolute inset-0 pointer-events-none" />

      <div className="relative z-10 max-w-md text-center space-y-6">
        <p className="text-xs font-mono uppercase tracking-[0.3em] text-primary">
          Merci
        </p>
        <h2 className="text-3xl font-bold text-foreground">
          Votre avis a été enregistré
        </h2>
        <p className="text-secondary-foreground leading-relaxed">
          Merci d'avoir participé à ce prototype. Vos retours nous sont précieux pour
          construire la suite de l'expérience "Où est Ava ?".
        </p>
        {newsletterRequested && (
          <p className="text-sm text-foreground" role="status" data-testid="newsletter-confirm-hint">
            Pour recevoir les Nouvelles de Gamiways, confirme ton inscription dans l'email que tu vas
            recevoir de Memoways.
          </p>
        )}
        <button
          onClick={onRestart}
          className="mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Recommencer l'expérience
        </button>
      </div>
    </div>
  );
};

export default ThanksScreen;
