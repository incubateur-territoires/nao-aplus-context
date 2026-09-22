"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { DataTable } from "@/app/component/data-table/data-table";
import { getUsersColumns, type UserRow } from "./users-columns/users-columns";
import { USER_ROLES, type UserRole } from "@/constants/user-roles";
import Alert from "@codegouvfr/react-dsfr/Alert";
import Input from "@codegouvfr/react-dsfr/Input";
import Button from "@codegouvfr/react-dsfr/Button";
import { Tabs } from "@codegouvfr/react-dsfr/Tabs";
import { Pagination } from "@/app/component/pagination/pagination";
import { useAnalytics } from "@/app/hooks/use-analytics";
import { useUrlTableState } from "@/app/hooks/use-url-table-state";
import { useFocusOnVisible } from "@/app/hooks/use-focus-on-visible";
import { ROUTE } from "@/app/constant/route";
import type { SortingState } from "@tanstack/react-table";

const ITEMS_PER_PAGE = 10;

// Au-delà de ce nombre de pages, les boutons « Première / Dernière page »
// (showFirstLast) sont masqués : combinés aux numéros à 4 chiffres, ils font
// déborder la pagination sur une 2e ligne. En dessous, on garde la logique
// complète.
const SHOW_FIRST_LAST_MAX_PAGES = 100;

const VALID_SORT_KEYS = ["member", "role"];
const DEFAULT_SORT = { id: "member", desc: false };

// Onglet actif mémorisé dans l'URL (param `u_tab`) : il survit à la navigation
// (consulter une fiche puis revenir garde l'onglet « en attente » sélectionné).
const TAB_ACTIVE = "actifs";
const TAB_PENDING = "attente";

export function UsersContent() {
  // Filtres mémorisés dans l'URL : ils survivent à la navigation (modifier un
  // utilisateur puis revenir) et restent partageables.
  const {
    searchInput: searchQuery,
    setSearchInput,
    debouncedSearch,
    page: currentPage,
    setPage,
    getNumberParam,
    setNumberParam,
    getStringParam,
    setStringParam,
    sorting,
    setSorting,
  } = useUrlTableState({
    prefix: "u_",
    defaultSort: DEFAULT_SORT,
    validSortKeys: VALID_SORT_KEYS,
    resetPageParams: ["pending_page"],
  });
  const pendingPage = getNumberParam("pending_page", 1);
  const setPendingPage = useCallback(
    (newPage: number) => setNumberParam("pending_page", newPage, 1),
    [setNumberParam],
  );
  const activeTab = getStringParam("tab", TAB_ACTIVE);
  const setActiveTab = useCallback(
    (value: string) => setStringParam("tab", value, TAB_ACTIVE),
    [setStringParam],
  );
  const [showResendAlert, setShowResendAlert] = useState(false);
  const resendAlertRef = useFocusOnVisible(showResendAlert);
  const [resendErrorMessage, setResendErrorMessage] = useState<string | null>(
    null,
  );
  const resendErrorRef = useFocusOnVisible(!!resendErrorMessage);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const { track } = useAnalytics();
  const trimmedSearch = debouncedSearch.trim();
  const hasTrackedSearch = useRef(false);

  const currentUserId = session?.user?.id;
  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;
  const isSupervisor = session?.user?.role === USER_ROLES.SUPERVISOR;
  const { data: isManager } = useQuery(trpc.user.isManager.queryOptions());
  const canEditUsers = isAdmin || isSupervisor || !!isManager;
  const canDeactivateUsers = isAdmin || isSupervisor || !!isManager;
  const canEditUserDetails = isAdmin;

  const currentSort = sorting[0];
  const { data: usersData, isLoading } = useQuery({
    ...trpc.user.getUsers.queryOptions({
      page: currentPage,
      pageSize: ITEMS_PER_PAGE,
      search: trimmedSearch || undefined,
      sortBy: currentSort?.id as "member" | "role" | undefined,
      sortOrder: currentSort
        ? ((currentSort.desc ? "desc" : "asc") as "asc" | "desc")
        : undefined,
    }),
    placeholderData: keepPreviousData,
  });

  // Fetch pending users for admin, supervisor, or manager
  const { data: pendingUsersData } = useQuery({
    ...trpc.user.getPendingUsers.queryOptions({
      page: pendingPage,
      pageSize: ITEMS_PER_PAGE,
      search: trimmedSearch || undefined,
    }),
    placeholderData: keepPreviousData,
    enabled: canEditUsers,
  });

  // La réinitialisation des deux paginations à la recherche est gérée par le
  // hook (resetPageParams).
  function handleSearchChange(value: string) {
    setSearchInput(value);
    hasTrackedSearch.current = false;
  }

  const handleSortingChange = useCallback(
    (newSorting: SortingState) => {
      setSorting(newSorting);
    },
    [setSorting],
  );

  const { mutateAsync: deactivateUser } = useMutation(
    trpc.user.deactivateUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.user.getUsers.queryKey(),
        });
      },
    }),
  );

  const { mutateAsync: reactivateUser } = useMutation(
    trpc.user.reactivateUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.user.getUsers.queryKey(),
        });
      },
    }),
  );

  const handleDeactivateUser = useCallback(
    async (userId: string) => {
      try {
        await deactivateUser({ userId });
      } catch (error) {
        console.error("Error deactivating user:", error);
      }
    },
    [deactivateUser],
  );

  const handleReactivateUser = useCallback(
    async (userId: string) => {
      try {
        await reactivateUser({ userId });
      } catch (error) {
        console.error("Error reactivating user:", error);
      }
    },
    [reactivateUser],
  );

  const handleResendSuccess = useCallback(() => {
    setResendErrorMessage(null);
    setShowResendAlert(true);
  }, []);

  const handleResendError = useCallback((message: string) => {
    setShowResendAlert(false);
    setResendErrorMessage(message);
  }, []);

  const activeUserRows: UserRow[] = useMemo(() => {
    return (
      usersData?.items?.map((user) => ({
        id: user.id,
        fullName: `${user.firstName} ${user.lastName}`,
        email: user.email,
        profession: user.profession,
        isInactive: !!user.isInactive,
        isPending: false,
        role: user.role as UserRole,
        isManager: (user.managedTeams?.length ?? 0) > 0,
        teams: (user.isInactive && user.deactivatedTeamSnapshot
          ? user.deactivatedTeamSnapshot.teams
          : user.teams
        ).map((team) => ({
          id: team.id,
          name: team.name,
          areas: team.areas.map((area) => ({
            id: area.id,
            name: area.name,
            inseeCode: area.inseeCode,
          })),
        })),
        supervisorAreas: user.supervisor?.areas.map((area) => ({
          id: area.id,
          name: area.name,
          inseeCode: area.inseeCode,
        })),
      })) || []
    );
  }, [usersData]);

  const pendingUserRows: UserRow[] = useMemo(() => {
    return (
      pendingUsersData?.items?.map((user) => ({
        id: user.id,
        fullName:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email,
        email: user.email,
        profession: null,
        isInactive: false,
        isPending: true,
        role: USER_ROLES.USER,
        isManager: (user.managedTeams?.length ?? 0) > 0,
        teams: user.teams.map((team) => ({
          id: team.id,
          name: team.name,
          areas: team.areas.map((area) => ({
            id: area.id,
            name: area.name,
            inseeCode: area.inseeCode,
          })),
        })),
      })) || []
    );
  }, [pendingUsersData]);

  const totalPages = usersData?.totalPages ?? 0;
  const activeTotal = usersData?.total ?? 0;
  const pendingTotalPages = pendingUsersData?.totalPages ?? 0;
  const pendingTotal = pendingUsersData?.total ?? 0;

  // Track search after results are loaded
  useEffect(() => {
    if (debouncedSearch && usersData && !hasTrackedSearch.current) {
      track("users_searched", {
        query: debouncedSearch,
        resultsCount: usersData.total,
      });
      hasTrackedSearch.current = true;
    }
  }, [debouncedSearch, usersData, track]);

  const columns = useMemo(
    () =>
      getUsersColumns(
        handleDeactivateUser,
        handleReactivateUser,
        canEditUsers,
        canDeactivateUsers,
        currentUserId,
        debouncedSearch,
        handleResendSuccess,
        canEditUserDetails,
        handleResendError,
      ),
    [
      canEditUsers,
      canDeactivateUsers,
      canEditUserDetails,
      currentUserId,
      debouncedSearch,
      handleDeactivateUser,
      handleReactivateUser,
      handleResendSuccess,
      handleResendError,
    ],
  );

  // Les utilisateurs en attente ne sont pas éditables : on omet la colonne
  // d'édition (crayon) pour gagner de la largeur et éviter le défilement
  // horizontal dans l'onglet « En attente ».
  const pendingColumns = useMemo(
    () =>
      getUsersColumns(
        handleDeactivateUser,
        handleReactivateUser,
        canEditUsers,
        canDeactivateUsers,
        currentUserId,
        debouncedSearch,
        handleResendSuccess,
        false,
        handleResendError,
      ),
    [
      canEditUsers,
      canDeactivateUsers,
      currentUserId,
      debouncedSearch,
      handleDeactivateUser,
      handleReactivateUser,
      handleResendSuccess,
      handleResendError,
    ],
  );

  const usersTab = (
    <div>
      <DataTable
        columns={columns}
        data={activeUserRows}
        manualSorting
        sorting={sorting}
        onSortingChange={handleSortingChange}
        emptyMessage="Aucun utilisateur ne correspond à vos critères de recherche."
      />
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={totalPages}
            defaultPage={currentPage}
            getPageLinkProps={(pageNumber) => ({
              href: "#",
              "aria-label": `Page ${pageNumber}`,
              onClick: (e) => {
                e.preventDefault();
                setPage(pageNumber);
              },
            })}
            showFirstLast={totalPages <= SHOW_FIRST_LAST_MAX_PAGES}
          />
        </div>
      )}
    </div>
  );

  const pendingTab = (
    <div>
      <DataTable
        columns={pendingColumns}
        data={pendingUserRows}
        emptyMessage={
          trimmedSearch
            ? "Aucun utilisateur ne correspond à vos critères de recherche."
            : "Aucun utilisateur en attente."
        }
      />
      {pendingTotalPages > 1 && (
        <div className="mt-6 flex justify-center">
          <Pagination
            count={pendingTotalPages}
            defaultPage={pendingPage}
            getPageLinkProps={(pageNumber) => ({
              href: "#",
              "aria-label": `Page ${pageNumber}`,
              onClick: (e) => {
                e.preventDefault();
                setPendingPage(pageNumber);
              },
            })}
            showFirstLast={pendingTotalPages <= SHOW_FIRST_LAST_MAX_PAGES}
          />
        </div>
      )}
    </div>
  );

  // L'onglet « en attente » reste visible même à 0 résultat : le masquer quand
  // une recherche ne matche aucun utilisateur en attente faisait disparaître
  // toute la barre d'onglets.
  const showPendingTab = canEditUsers;

  // `isDefault` est lu par DSFR au montage : on le calcule depuis l'URL pour
  // restaurer l'onglet mémorisé au retour de navigation.
  const tabs = showPendingTab
    ? [
        {
          label: `Utilisateurs actifs (${activeTotal})`,
          content: usersTab,
          isDefault: activeTab !== TAB_PENDING,
        },
        {
          label: `Utilisateurs en attente (${pendingTotal})`,
          content: pendingTab,
          isDefault: activeTab === TAB_PENDING,
        },
      ]
    : [
        {
          label: `Utilisateurs actifs (${activeTotal})`,
          content: usersTab,
          isDefault: true,
        },
      ];

  return (
    <div className="p-4 md:p-20 bg-white relative">
      {resendErrorMessage && (
        <div className="mb-6" ref={resendErrorRef} tabIndex={-1}>
          <Alert
            severity="info"
            role="status"
            title="Invitation non renvoyée"
            closable
            onClose={() => setResendErrorMessage(null)}
            description={resendErrorMessage}
          />
        </div>
      )}
      {showResendAlert && (
        <div className="mb-6" ref={resendAlertRef} tabIndex={-1}>
          <Alert
            severity="success"
            role="status"
            title="L'invitation a bien été renvoyée."
            closable
            onClose={() => setShowResendAlert(false)}
            description={
              <>
                Si l&apos;utilisateur n&apos;a pas reçu d&apos;e-mail
                d&apos;invitation sous une heure, son filtre anti-spam bloque
                peut-être la réception de nos messages. Dans ce cas, vous pouvez{" "}
                <a
                  href="https://docs.aplus.beta.gouv.fr/contacter-lequipe"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  contacter notre support
                  <span className="sr-only"> - nouvelle fenêtre</span>
                </a>
                .
              </>
            }
          />
        </div>
      )}
      <div className="mb-8">
        <Input
          addon={
            <span className="bg-blue-primary p-2 rounded-tr-[4px] text-white fr-icon-search-line -mt-px" />
          }
          className="w-full max-w-[480px]"
          id="search-users"
          label="Rechercher"
          hintText="Les résultats se mettent à jour automatiquement à la saisie."
          nativeLabelProps={{ className: "fr-h6 block mb-2" }}
          nativeInputProps={{
            placeholder: "Rechercher un nom, une adresse e-mail...",
            type: "text",
            value: searchQuery,
            onChange: (e) => handleSearchChange(e.target.value),
          }}
        />
      </div>

      {isLoading ? (
        <div role="status">Chargement...</div>
      ) : showPendingTab ? (
        <Tabs
          tabs={tabs}
          onTabChange={({ tabIndex }) =>
            setActiveTab(tabIndex === 1 ? TAB_PENDING : TAB_ACTIVE)
          }
        />
      ) : (
        <div>{usersTab}</div>
      )}

      {isAdmin && (
        <div className="flex justify-end mt-8">
          <Button
            priority="secondary"
            iconId="ri-user-add-line"
            linkProps={{
              href: ROUTE.CREATE_SUPERVISOR,
            }}
          >
            Créer un superviseur
          </Button>
        </div>
      )}
    </div>
  );
}
