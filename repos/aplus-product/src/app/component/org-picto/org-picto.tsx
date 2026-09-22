interface OrgPictoConfig {
  label: string;
  bgColor: string;
  fontSize: string;
}

const ORG_CONFIGS_RAW: Record<string, OrgPictoConfig> = {
  "maison france services": {
    label: "FS",
    bgColor: "#6a6156",
    fontSize: "16px",
  },
  fs: { label: "FS", bgColor: "#6a6156", fontSize: "16px" },
  "maison de services au public": {
    label: "MSAP",
    bgColor: "#6a6156",
    fontSize: "12px",
  },
  bdf: { label: "BDF", bgColor: "#6a6156", fontSize: "16px" },
  association: { label: "Asso.", bgColor: "#6a6156", fontSize: "14px" },
  ccas: { label: "CCAS", bgColor: "#6a6156", fontSize: "12px" },
  département: { label: "Dépt.", bgColor: "#6a6156", fontSize: "12px" },
  dila: { label: "DILA", bgColor: "#6a6156", fontSize: "14px" },
  hôpital: { label: "Hôp.", bgColor: "#6a6156", fontSize: "14px" },
  mairie: { label: "Mairie", bgColor: "#6a6156", fontSize: "12px" },
  mdph: { label: "MDPH", bgColor: "#6a6156", fontSize: "12px" },
  "mission locale": { label: "M. loc.", bgColor: "#6a6156", fontSize: "12px" },
  ants: { label: "ANTS", bgColor: "#845d48", fontSize: "12px" },
  "préfecture - ants": { label: "Préf.", bgColor: "#845d48", fontSize: "14px" },
  préfecture: { label: "Préf.", bgColor: "#845d48", fontSize: "14px" },
  préf: { label: "Préf.", bgColor: "#845d48", fontSize: "14px" },
  "sous préfecture": {
    label: "Ss.Préf.",
    bgColor: "#845d48",
    fontSize: "12px",
  },
  caf: { label: "CAF", bgColor: "#3558a2", fontSize: "16px" },
  carsat: { label: "Carsat", bgColor: "#a94645", fontSize: "12px" },
  cnav: { label: "CNAV", bgColor: "#a94645", fontSize: "12px" },
  cpam: { label: "CPAM", bgColor: "#297254", fontSize: "12px" },
  cnam: { label: "CNAM", bgColor: "#297254", fontSize: "12px" },
  cram: { label: "CRAM", bgColor: "#297254", fontSize: "12px" },
  msa: { label: "MSA", bgColor: "#66673d", fontSize: "16px" },
  "chèque énergie": { label: "Ch.en.", bgColor: "#685c48", fontSize: "12px" },
  ddfip: { label: "DGFIP", bgColor: "#2f4077", fontSize: "12px" },
  "la poste": { label: "Poste", bgColor: "#716043", fontSize: "12px" },
  "france travail": { label: "FT", bgColor: "#755348", fontSize: "16px" },
  urssaf: { label: "urssaf", bgColor: "#447049", fontSize: "12px" },
  cdad: { label: "CDAD", bgColor: "#6e445a", fontSize: "12px" },
};

const ORG_CONFIGS: Record<string, OrgPictoConfig> = Object.fromEntries(
  Object.entries(ORG_CONFIGS_RAW).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]),
);

export function getOrgPictoConfig(orgName: string): OrgPictoConfig {
  const key = orgName.trim().toLowerCase();
  return (
    ORG_CONFIGS[key] ?? {
      label: orgName.slice(0, 3).toUpperCase(),
      bgColor: "#6a6156",
      fontSize: "12px",
    }
  );
}

interface OrgPictoProps {
  orgName: string;
  className?: string;
}

export function OrgPicto({ orgName, className }: OrgPictoProps) {
  const config = getOrgPictoConfig(orgName);

  return (
    <div
      aria-hidden="true"
      className={`shrink-0 flex items-center justify-center rounded-full w-12 h-12${className ? ` ${className}` : ""}`}
      style={{ backgroundColor: config.bgColor }}
    >
      <span style={{ fontSize: config.fontSize, color: "#fff", lineHeight: 1 }}>
        {config.label}
      </span>
    </div>
  );
}
