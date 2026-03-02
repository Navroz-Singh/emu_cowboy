export default function CabinetShell({ children }) {
  return (
    <div className="cabinet-lines relative h-[100dvh] overflow-hidden bg-(--cabinet-tan) px-2 py-2 md:px-3 md:py-3">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-5 top-5 h-3 w-3 rounded-full bg-(--border-brown)/40" />
        <div className="absolute right-5 top-5 h-3 w-3 rounded-full bg-(--border-brown)/40" />
        <div className="absolute bottom-5 left-5 h-3 w-3 rounded-full bg-(--border-brown)/40" />
        <div className="absolute bottom-5 right-5 h-3 w-3 rounded-full bg-(--border-brown)/40" />
        <div className="absolute bottom-5 right-9 h-2 w-2 rotate-45 bg-white/70 shadow-[0_0_10px_2px_rgba(255,255,255,0.6)]" />
        <div className="dust-mote absolute bottom-16 left-6 h-2 w-2" />
        <div className="dust-mote absolute bottom-20 right-8 h-1.5 w-1.5 [animation-delay:300ms]" />
        <div className="dust-mote absolute top-16 left-10 h-1.5 w-1.5 [animation-delay:700ms]" />
      </div>
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-[1450px] items-center justify-center">
        {children}
      </div>
    </div>
  );
}
