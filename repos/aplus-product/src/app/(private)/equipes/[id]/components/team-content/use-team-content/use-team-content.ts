"use client";

import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { useSession } from "@/app/component/auth-provider/auth-provider";
import { OrganizationRole } from "@/generated/prisma/enums";
import { USER_ROLES } from "@/constants/user-roles";
import { TeamRole } from "@/types/team";
import {
  getActivityLabels,
  getLastActivityDate,
} from "../team-content-utils/team-content.utils";
import type { TeamMemberRow } from "../team-content-columns/team-content-columns";

interface UseTeamContentOptions {
  teamId: string;
}

export function useTeamContent({ teamId }: UseTeamContentOptions) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: team } = useSuspenseQuery(
    trpc.team.getTeamById.queryOptions(teamId),
  );
  const { data: activityMetrics } = useSuspenseQuery(
    trpc.team.getTeamMembersActivity.queryOptions(teamId),
  );
  const { data: session } = useSession();

  const isManager =
    team?.managers.some((manager) => manager.id === session?.user?.id) ?? false;
  const isAdmin = session?.user?.role === USER_ROLES.ADMIN;

  const { mutateAsync: removeUserFromTeam } = useMutation(
    trpc.team.removeUserFromTeam.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.team.getTeamById.queryOptions(teamId),
        );
      },
    }),
  );

  const { mutateAsync: deactivateUser } = useMutation(
    trpc.user.deactivateUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.team.getTeamById.queryOptions(teamId),
        );
      },
    }),
  );

  const { mutateAsync: reactivateUser } = useMutation(
    trpc.user.reactivateUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.refetchQueries(
          trpc.team.getTeamById.queryOptions(teamId),
        );
      },
    }),
  );

  async function handleRemoveUser(userId: string): Promise<boolean> {
    try {
      await removeUserFromTeam({ teamId, userId });
      return true;
    } catch (error) {
      console.error("Error removing user from team:", error);
      return false;
    }
  }

  async function handleDeactivateUser(userId: string) {
    try {
      await deactivateUser({ userId });
    } catch (error) {
      console.error("Error deactivating user:", error);
    }
  }

  async function handleReactivateUser(userId: string) {
    try {
      await reactivateUser({ userId });
    } catch (error) {
      console.error("Error reactivating user:", error);
    }
  }

  const members: TeamMemberRow[] =
    team?.users.map((user) => {
      const fullName = `${user.firstName} ${user.lastName}`;
      const authoredDates = user.authoredReports?.map(
        (report) => report.createdAt,
      );
      const coAuthoredDates = user.coAuthoredReports?.map(
        (report) => report.createdAt,
      );
      const allDates = [...(authoredDates || []), ...(coAuthoredDates || [])];
      const lastActivity = getLastActivityDate(allDates);

      const roleLabel =
        user.role === USER_ROLES.ADMIN
          ? USER_ROLES.ADMIN
          : user.role === USER_ROLES.SUPERVISOR
            ? USER_ROLES.SUPERVISOR
            : team.managers.some((manager) => manager.id === user.id)
              ? TeamRole.MANAGER
              : "";

      const userMetrics = activityMetrics?.[user.id];
      const activityLabels = getActivityLabels(userMetrics);

      return {
        id: user.id,
        fullName,
        lastName: user.lastName,
        email: user.email,
        roleLabel,
        profession: user.profession,
        activityLabels,
        activityMetrics: userMetrics,
        lastActivity,
        isPending: false,
        isInactive: !!user.isInactive,
      };
    }) || [];

  const pendingMembers: TeamMemberRow[] =
    team?.pendingUsers.map((pendingUser) => {
      const fullName = `${pendingUser.email}`;
      return {
        id: pendingUser.id,
        fullName,
        lastName: "",
        email: pendingUser.email,
        roleLabel: team.pendingManagers.some(
          (manager) => manager.id === pendingUser.id,
        )
          ? TeamRole.MANAGER
          : "",
        profession: "",
        activityLabels: [],
        activityMetrics: undefined,
        lastActivity: null,
        isPending: true,
        isInactive: false,
      };
    }) || [];

  const isOperatorGroup = team?.role === OrganizationRole.OPERATOR;
  const data = [...members, ...pendingMembers];

  return {
    team,
    isManager,
    isAdmin,
    isOperatorGroup,
    members,
    pendingMembers,
    data,
    handleRemoveUser,
    handleDeactivateUser,
    handleReactivateUser,
    currentUserId: session?.user?.id,
  };
}
