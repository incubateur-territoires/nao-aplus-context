import Image from "next/image";

const PARTNER_ROWS = [
  [
    { src: "/assets/homepage/logos/0.jpg", alt: "France Services" },
    { src: "/assets/homepage/logos/1.jpg", alt: "URSSAF" },
    { src: "/assets/homepage/logos/2.jpg", alt: "L'Assurance Retraite" },
    {
      src: "/assets/homepage/logos/8.jpg",
      alt: "Caisse d'Allocations Familiales",
    },
  ],
  [
    {
      src: "/assets/homepage/logos/4.jpg",
      alt: "Direction Générale des Finances Publiques",
    },
    { src: "/assets/homepage/logos/5.jpg", alt: "Assurance Maladie" },
    { src: "/assets/homepage/logos/6.jpg", alt: "Mutualité Sociale Agricole" },
    { src: "/assets/homepage/logos/7.jpg", alt: "France Travail" },
  ],
  [{ src: "/assets/homepage/logos/9.jpg", alt: "La Poste" }],
];

export function PartnersSection() {
  return (
    <section className="bg-blue-background px-5 py-20">
      <div className="px-5 max-w-[1200px] mx-auto">
        <h2 className="fr-h1 mb-10">Ils échangent grâce à Administration+</h2>
        <div className="flex flex-col gap-6">
          {PARTNER_ROWS.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className={`grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-6 ${
                row.length === 1 ? "justify-items-start" : ""
              }`}
            >
              {row.map((partner) => (
                <div
                  key={partner.alt}
                  className={`bg-white overflow-hidden ${
                    row.length === 1 ? "col-start-1 row-start-1 w-full" : ""
                  }`}
                >
                  <Image
                    src={partner.src}
                    alt={partner.alt}
                    width={564}
                    height={400}
                    className="w-full h-auto"
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
