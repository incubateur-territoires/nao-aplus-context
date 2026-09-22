export function KeyFiguresSection() {
  return (
    <section className="relative text-white overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/homepage/bg-chiffres.jpg')" }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative px-5 max-w-[1200px] mx-auto py-20 md:py-[120px] flex flex-col gap-16">
        <h2 className="fr-h1 mb-0 text-white">Chiffres clés</h2>

        <div className="flex flex-col gap-6">
          {/* Row 1 */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 9 années */}
            <div className="bg-white flex flex-col lg:h-[440px] shrink-0">
              {/* RGAA 8.9 : nombre + libellé regroupés dans un seul paragraphe. */}
              <p className="flex flex-col items-center gap-2 pt-10 pb-6 text-blue-primary text-center m-0">
                <span className="text-[120px] md:text-[160px] leading-none font-light">
                  9
                </span>
                <span className="text-xl font-bold leading-8">
                  années
                  <br />
                  d&apos;existence
                </span>
              </p>
              <div className="border-t border-[#ddd] flex-1 flex items-center justify-center px-8 py-6">
                <p className="text-lg text-center text-[#3a3a3a]">
                  <strong>Lancement en décembre 2017</strong>
                  <br />à Argenteuil (Val-d&apos;Oise)
                </p>
              </div>
            </div>

            {/* ±150 000 */}
            <div className="bg-white flex flex-col items-end justify-end p-8 lg:h-[440px] flex-1">
              <span
                className="fr-icon-line-chart-line text-blue-primary self-end"
                aria-hidden="true"
              />
              {/* RGAA 8.9 : nombre + libellés regroupés dans un seul paragraphe. */}
              <p className="flex flex-col items-end text-right w-full m-0">
                <span className="text-[56px] sm:text-[80px] md:text-[110px] xl:text-[140px] leading-none text-blue-primary whitespace-nowrap">
                  ±150&nbsp;000
                </span>
                <span className="text-xl font-bold leading-8 text-blue-primary pt-2">
                  signalements traités par an
                </span>
                <span className="text-xl leading-8 text-[#161616] pb-6">
                  soit ±12 000 par mois
                </span>
              </p>
            </div>
          </div>

          {/* Row 2 */}
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left column */}
            <div className="flex flex-col gap-6 lg:w-[792px]">
              {/* 9 027 */}
              <div className="bg-white p-8 lg:h-[288px] flex flex-col justify-center">
                {/* RGAA 8.9 : nombre + libellé regroupés dans un seul paragraphe. */}
                <p className="flex flex-col m-0">
                  <span className="text-[80px] md:text-[160px] leading-none text-blue-primary">
                    9&nbsp;027
                  </span>
                  <span className="text-xl text-[#161616]">
                    <strong>utilisateurs actifs</strong> en mars 2026
                  </span>
                </p>
              </div>

              {/* Bottom row */}
              <div className="flex flex-col md:flex-row gap-6">
                {/* Aidants/opérateurs */}
                <div className="bg-white p-8 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-base text-[#161616] m-0">5977 aidants</p>
                    <div className="flex gap-1" aria-hidden="true">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span
                          key={i}
                          className="fr-icon-user-fill text-[#161616]"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-base text-[#161616] m-0">
                      3050 opérateurs
                    </p>
                    <div className="flex gap-1" aria-hidden="true">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <span
                          key={i}
                          className="fr-icon-user-fill text-[#161616]"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 9 opérateurs partenaires */}
                {/* RGAA 8.9 : nombre + libellés regroupés dans un seul paragraphe. */}
                <p className="bg-white p-8 flex-1 flex items-end gap-2 m-0">
                  <span className="text-[64px] leading-none text-blue-primary">
                    9
                  </span>
                  <span className="flex flex-col">
                    <span className="text-base text-[#161616]">
                      opérateurs partenaires
                    </span>
                    <span className="text-xs font-bold text-[#161616]">
                      CNAM, CAF, MSA, France Travail...
                    </span>
                  </span>
                </p>
              </div>
            </div>

            {/* 79% */}
            <div className="bg-white flex flex-col items-center justify-center gap-6 flex-1 py-10 lg:h-[432px]">
              <span
                className="fr-icon-trophy-line text-blue-primary text-[32px]"
                aria-hidden="true"
              />
              {/* RGAA 8.9 : nombre + libellé regroupés dans un seul paragraphe. */}
              <p className="flex flex-col items-center gap-2 text-center m-0">
                <span className="text-[120px] md:text-[160px] leading-none text-blue-primary">
                  79%
                </span>
                <span className="text-xl text-[#161616]">
                  des blocages résolus
                  <br />
                  <strong>en 7 jours</strong>
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
