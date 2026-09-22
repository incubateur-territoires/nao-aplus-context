export function MaintenancePage() {
  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Maintenance - Administration+</title>
      </head>
      <body className="flex min-h-screen items-center justify-center bg-[#f6f6f6]">
        <div className="max-w-xl px-8 text-center">
          <div className="mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo/a+.svg"
              alt="Logo Administration+"
              className="mx-auto h-80"
            />
          </div>
          <span className="mb-6 inline-block bg-blue-primary px-3 py-1 text-sm font-bold uppercase tracking-wide text-white">
            Maintenance
          </span>
          <h1 className="mb-4 text-3xl font-bold text-[#161616]">
            Service temporairement indisponible
          </h1>
          <div className="mx-auto my-6 h-[3px] w-20 bg-blue-primary" />
          <p className="text-lg leading-relaxed text-[#3a3a3a]">
            Administration+ est actuellement en maintenance.
            <br />
            Nous mettons tout en œuvre pour rétablir le service dans les
            meilleurs délais.
          </p>
          <p className="mt-8 text-sm text-[#666]">
            Merci de votre compréhension.
          </p>
        </div>
      </body>
    </html>
  );
}
