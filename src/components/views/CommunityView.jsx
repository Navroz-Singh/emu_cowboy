export default function CommunityView() {
  const columns = [
    {
      title: "FORUM DISCUSSIONS",
      button: "NEW POST",
      items: ["[PIXEL FISTFIGHT MODDING CHAT]", "[DUSTBOWL TIPS]", "[PONG STRATEGIES]"],
    },
    {
      title: "TOP COMMUNITY CREATIONS",
      button: "VIEW ALL",
      items: ["[SPACE SHIP RESKIN]", "[SALOON UI PACK]", "[DUST FX SET]"] ,
    },
    {
      title: "PLATFORM EVENTS",
      button: "VIEW CALENDAR",
      items: ["[SPRING TOURNAMENT - MAR 10]", "[COMMUNITY NIGHT - APR 2]", "[PATCH JAM - APR 20]"],
    },
  ];

  return (
    <section className="grid h-full grid-cols-1 gap-3 md:grid-cols-3">
      {columns.map((column) => (
        <div key={column.title} className="arcade-border flex min-h-0 flex-col bg-[var(--cabinet-tan)]/35 p-3">
          <h3 className="mb-3 text-[10px] md:text-xs">{column.title}</h3>
          <div className="space-y-2 text-[9px] leading-5 md:text-[10px]">
            {column.items.map((item) => (
              <div key={item} className="arcade-border bg-[var(--screen-bg)]/70 p-2">{item}</div>
            ))}
          </div>
          <button className="pixel-button mt-auto px-3 py-2 text-[10px]" type="button">
            {column.button}
          </button>
        </div>
      ))}
    </section>
  );
}
