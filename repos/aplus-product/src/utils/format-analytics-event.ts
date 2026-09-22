import { EVENT_CATEGORIES, type EventCategory } from "@/types/analytics";

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  [EVENT_CATEGORIES.PAGE_VIEW]: "Navigation",
  [EVENT_CATEGORIES.AUTH]: "Authentification",
  [EVENT_CATEGORIES.REPORT]: "Signalement",
  [EVENT_CATEGORIES.ANSWER]: "Réponse",
  [EVENT_CATEGORIES.FILE]: "Fichier",
  [EVENT_CATEGORIES.USER]: "Utilisateur",
  [EVENT_CATEGORIES.TEAM]: "Équipe",
  [EVENT_CATEGORIES.SEARCH]: "Recherche",
};

export function getEventCategoryLabel(category: string): string {
  return EVENT_CATEGORY_LABELS[category as EventCategory] ?? category;
}

interface FormatAnalyticsEventParams {
  eventName: string;
  metadata: unknown;
  actorName: string | null;
  targetName: string | null;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count > 1 ? (plural ?? `${singular}s`) : singular}`;
}

function formatFields(fields: string[]): string {
  return fields.length > 0 ? ` (champs : ${fields.join(", ")})` : "";
}

function formatSearch(what: string, metadata: Record<string, unknown>): string {
  const query = asString(metadata.query);
  const resultsCount = asNumber(metadata.resultsCount);
  const queryPart = query ? ` : « ${query} »` : "";
  const resultsPart =
    resultsCount !== null ? ` (${pluralize(resultsCount, "résultat")})` : "";
  return `Recherche ${what}${queryPart}${resultsPart}`;
}

// Transforme un événement analytics brut en phrase française lisible pour la
// vue support (« qui a fait quoi »). Les événements où l'utilisateur consulté
// est la cible mentionnent l'acteur et la cible.
export function formatAnalyticsEventDescription({
  eventName,
  metadata,
  actorName,
  targetName,
}: FormatAnalyticsEventParams): string {
  const data = asRecord(metadata);
  const actor = actorName ?? "Un utilisateur inconnu";
  const target =
    targetName ?? asString(data.targetEmail) ?? "un utilisateur inconnu";

  switch (eventName) {
    // Authentification
    case "auth_sign_in": {
      const method = asString(data.method);
      return method ? `Connexion (${method})` : "Connexion";
    }
    case "auth_sign_in_failed": {
      const method = asString(data.method);
      return method ? `Échec de connexion (${method})` : "Échec de connexion";
    }
    case "auth_sign_out":
      return "Déconnexion";
    case "auth_registration_complete":
      return "Inscription finalisée";
    case "auth_account_created":
      return "Compte créé";
    case "auth_impersonate_user":
      return `${actor} a pris le contrôle du compte de ${target}`;
    case "auth_stop_impersonation":
      return `${actor} a quitté le mode « Aperçu de l'utilisateur »`;
    case "auth_password_reset_requested":
      return "Réinitialisation du mot de passe demandée";
    case "auth_password_reset_completed":
      return "Mot de passe réinitialisé";

    // Signalements
    case "report_created": {
      const numFiles = asNumber(data.numFiles);
      const numTeams = asNumber(data.numTeams);
      const details = [
        numFiles !== null ? pluralize(numFiles, "fichier") : null,
        numTeams !== null ? pluralize(numTeams, "équipe") : null,
      ].filter(Boolean);
      return details.length > 0
        ? `Signalement créé (${details.join(", ")})`
        : "Signalement créé";
    }
    case "report_viewed":
      return "Signalement consulté";
    case "report_status_changed": {
      const oldStatus = asString(data.oldStatus);
      const newStatus = asString(data.newStatus);
      return oldStatus && newStatus
        ? `Statut du signalement modifié : ${oldStatus} → ${newStatus}`
        : "Statut du signalement modifié";
    }
    case "report_teams_invited": {
      const count = asStringArray(data.teamIds).length;
      return count > 0
        ? `${pluralize(count, "équipe invitée", "équipes invitées")} sur un signalement`
        : "Équipe(s) invitée(s) sur un signalement";
    }
    case "report_colleagues_invited": {
      const count = asStringArray(data.colleagueIds).length;
      return count > 0
        ? `${pluralize(count, "collègue invité", "collègues invités")} sur un signalement`
        : "Collègue(s) invité(s) sur un signalement";
    }

    // Réponses
    case "answer_created":
      return data.isOperatorOnly === true
        ? "Réponse ajoutée à un signalement (visible des opérateurs uniquement)"
        : "Réponse ajoutée à un signalement";
    case "answer_viewed":
      return "Réponse consultée";
    case "answers_batch_viewed": {
      const count = asNumber(data.count);
      return count !== null
        ? `${pluralize(count, "réponse consultée", "réponses consultées")} sur un signalement`
        : "Réponses consultées sur un signalement";
    }

    // Fichiers
    case "file_uploaded": {
      const fileSize = asNumber(data.fileSize);
      return fileSize !== null
        ? `Fichier déposé (${Math.max(1, Math.round(fileSize / 1024))} Ko)`
        : "Fichier déposé";
    }
    case "file_downloaded":
      return "Fichier téléchargé";

    // Utilisateurs
    case "user_profile_updated":
      return `Profil mis à jour${formatFields(asStringArray(data.fieldsUpdated))}`;
    case "user_admin_updated":
      return `${actor} a modifié le profil de ${target}${formatFields(asStringArray(data.fieldsUpdated))}`;
    case "user_deactivated":
      return `${actor} a désactivé ${target}`;
    case "user_reactivated":
      return `${actor} a réactivé ${target}`;

    // Équipes
    case "team_created":
      return "Équipe créée";
    case "team_updated":
      return `Équipe modifiée${formatFields(asStringArray(data.fieldsUpdated))}`;
    case "team_deleted": {
      const teamName = asString(data.teamName);
      return teamName ? `Équipe supprimée (${teamName})` : "Équipe supprimée";
    }
    case "team_member_added": {
      const numAdded = asNumber(data.numAdded);
      return numAdded !== null
        ? `${pluralize(numAdded, "membre ajouté", "membres ajoutés")} à une équipe`
        : "Membre(s) ajouté(s) à une équipe";
    }
    case "team_member_removed":
      return `${actor} a retiré ${target} d'une équipe`;
    case "team_viewed":
      return "Équipe consultée";

    // Navigation
    case "page_view":
      return "Page consultée";

    // Recherches
    case "teams_searched":
      return formatSearch("d'équipes", data);
    case "users_searched":
      return formatSearch("d'utilisateurs", data);
    case "reports_searched":
      return formatSearch("de signalements", data);

    default:
      return eventName;
  }
}
