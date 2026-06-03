--
-- PostgreSQL database dump
--

\restrict HG73umjmUiIUAj9SIWrI4zB70D1w4oFoTprlVhHxw5MR9SagBCjFDEWlNLn81MZ

-- Dumped from database version 17.9 (Debian 17.9-1.pgdg12+1)
-- Dumped by pg_dump version 17.10 (Debian 17.10-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: NotificationFrequency; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationFrequency" AS ENUM (
    'EACH_SOLICITATION',
    'TWICE_DAILY',
    'ONCE_DAILY',
    'NONE'
);


--
-- Name: NotificationType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."NotificationType" AS ENUM (
    'ANSWER',
    'STATUS_CHANGE',
    'REPORT'
);


--
-- Name: OrganizationRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."OrganizationRole" AS ENUM (
    'OPERATOR',
    'HELPER'
);


--
-- Name: ReportStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReportStatus" AS ENUM (
    'PENDING_ASSIGNMENT',
    'IN_TREATMENT',
    'COMPLETED',
    'CLOSED',
    'DELETED'
);


--
-- Name: StandardProcedure; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StandardProcedure" AS ENUM (
    'NOT_CONCERNED',
    'HAS_STANDARD_PROCEDURE',
    'NO_STANDARD_PROCEDURE'
);


--
-- Name: TeamType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TeamType" AS ENUM (
    'FRANCE_SERVICE',
    'HISTORICAL_SOCIAL_WORKER',
    'TZNR',
    'OTHERS_HELPERS',
    'OPERATOR'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp(3) without time zone,
    "refreshTokenExpiresAt" timestamp(3) without time zone,
    scope text,
    password text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


--
-- Name: AnalyticsEvent; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnalyticsEvent" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "eventName" text NOT NULL,
    "eventCategory" text NOT NULL,
    "userId" text,
    "sessionId" text,
    "pageUrl" text,
    "pagePath" text,
    referrer text,
    metadata jsonb,
    "userAgent" text,
    "ipAddress" text,
    "occurredAt" timestamp(3) without time zone
);


--
-- Name: Answer; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Answer" (
    id text NOT NULL,
    "authorId" text NOT NULL,
    content text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isIrrelevant" boolean DEFAULT false NOT NULL,
    "reportId" text NOT NULL,
    "isMetadataOnly" boolean DEFAULT false NOT NULL,
    "hasStandardProcedure" boolean DEFAULT false NOT NULL,
    "isOperatorOnly" boolean DEFAULT false NOT NULL
);


--
-- Name: AnswerView; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."AnswerView" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "answerId" text NOT NULL,
    "viewedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Area; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Area" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text NOT NULL,
    "inseeCode" text NOT NULL,
    timezone text DEFAULT 'Europe/Paris'::text NOT NULL
);


--
-- Name: DeactivatedUserTeamSnapshot; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DeactivatedUserTeamSnapshot" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: File; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."File" (
    id text NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    size integer NOT NULL,
    "lastModified" timestamp(3) without time zone NOT NULL,
    "reportId" text NOT NULL
);


--
-- Name: MaintenanceMode; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MaintenanceMode" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL
);


--
-- Name: NotificationView; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."NotificationView" (
    id text NOT NULL,
    "userId" text NOT NULL,
    type public."NotificationType" NOT NULL,
    "targetId" text NOT NULL,
    "viewedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Organization; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Organization" (
    id text NOT NULL,
    id_v1 text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "additionalInformation" text,
    name text NOT NULL,
    "shortName" text NOT NULL,
    role public."OrganizationRole" DEFAULT 'HELPER'::public."OrganizationRole" NOT NULL,
    type public."TeamType" DEFAULT 'OTHERS_HELPERS'::public."TeamType" NOT NULL
);


--
-- Name: OrganizationTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."OrganizationTag" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text NOT NULL
);


--
-- Name: PendingSupervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PendingSupervisor" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    email text NOT NULL
);


--
-- Name: PendingUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PendingUser" (
    id text NOT NULL,
    email text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "firstName" text,
    "lastName" text,
    "tokenExpiresAt" timestamp(3) without time zone NOT NULL,
    "verificationToken" text NOT NULL
);


--
-- Name: Report; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Report" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "areaId" text NOT NULL,
    subject text NOT NULL,
    description text NOT NULL,
    caf text,
    nir text,
    nif text,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "birthDate" text NOT NULL,
    phone text,
    "citizenPermissionConfirmed" boolean NOT NULL,
    "applicantTeamId" text NOT NULL,
    "organizationId" text,
    status public."ReportStatus" DEFAULT 'PENDING_ASSIGNMENT'::public."ReportStatus" NOT NULL,
    "authorId" text NOT NULL,
    "userId" text,
    "lastAnswerAt" timestamp(3) without time zone,
    "overdueAt" timestamp(3) without time zone,
    "maritalName" text
);


--
-- Name: ReportStatusHistory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ReportStatusHistory" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reportId" text NOT NULL,
    status public."ReportStatus" NOT NULL,
    "authorId" text,
    "answerId" text
);


--
-- Name: Session; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Session" (
    id text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL,
    "impersonatedBy" text
);


--
-- Name: SiteBanner; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."SiteBanner" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    severity text DEFAULT 'info'::text NOT NULL,
    content text NOT NULL,
    "isActive" boolean DEFAULT false NOT NULL,
    "authorId" text NOT NULL,
    "displayOnPublicPages" boolean DEFAULT false NOT NULL
);


--
-- Name: Supervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Supervisor" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "userId" text NOT NULL
);


--
-- Name: Team; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Team" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    name text NOT NULL,
    "organizationId" text NOT NULL,
    role public."OrganizationRole" DEFAULT 'HELPER'::public."OrganizationRole" NOT NULL,
    description text,
    email text,
    "registrationNumber" text,
    "adminComment" text,
    "internalSupportComment" text,
    "publicNote" text,
    "acceptTypes" public."TeamType"[] DEFAULT ARRAY['OPERATOR'::public."TeamType", 'FRANCE_SERVICE'::public."TeamType", 'HISTORICAL_SOCIAL_WORKER'::public."TeamType", 'TZNR'::public."TeamType", 'OTHERS_HELPERS'::public."TeamType"] NOT NULL,
    type public."TeamType" DEFAULT 'OTHERS_HELPERS'::public."TeamType" NOT NULL,
    "deletedAt" timestamp(3) without time zone
);


--
-- Name: TeamSpecificField; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TeamSpecificField" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    label text NOT NULL,
    "hintText" text,
    name text NOT NULL,
    "errorMessage" text NOT NULL
);


--
-- Name: TwoFactor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."TwoFactor" (
    id text NOT NULL,
    secret text NOT NULL,
    "backupCodes" text NOT NULL,
    "userId" text NOT NULL,
    verified boolean DEFAULT true NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    email text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    name text NOT NULL,
    "emailVerified" boolean DEFAULT false NOT NULL,
    phone text,
    profession text,
    "isInactive" timestamp(3) without time zone,
    "cguAcceptedAt" timestamp(3) without time zone,
    "inactivityWarningsSentAt" timestamp(3) without time zone[] DEFAULT (ARRAY[]::timestamp without time zone[])::timestamp(3) without time zone[],
    "lastActivityAt" timestamp(3) without time zone,
    "notificationFrequency" public."NotificationFrequency" DEFAULT 'EACH_SOLICITATION'::public."NotificationFrequency" NOT NULL,
    "lastDigestSentAt" timestamp(3) without time zone,
    role text DEFAULT 'user'::text NOT NULL,
    "internalSupportComment" text,
    "newsLetterAcceptedAt" timestamp(3) without time zone,
    "banExpires" timestamp(3) without time zone,
    "banReason" text,
    banned boolean DEFAULT false NOT NULL,
    "deletedAt" timestamp(3) without time zone,
    "twoFactorEnabled" boolean DEFAULT false,
    "notificationsViewedBefore" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: Verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Verification" (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: _AnswerToFile; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_AnswerToFile" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _AreaToPendingSupervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_AreaToPendingSupervisor" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _AreaToSupervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_AreaToSupervisor" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _AreaToTeam; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_AreaToTeam" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _DeactivatedUserManagedTeams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_DeactivatedUserManagedTeams" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _DeactivatedUserTeams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_DeactivatedUserTeams" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _OrganizationToOrganizationTag; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_OrganizationToOrganizationTag" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _OrganizationToPendingSupervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_OrganizationToPendingSupervisor" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _OrganizationToSupervisor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_OrganizationToSupervisor" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _OrganizationToTeamSpecificField; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_OrganizationToTeamSpecificField" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _PendingManagersTeams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_PendingManagersTeams" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _PendingUsersTeams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_PendingUsersTeams" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _ReportCoAuthors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_ReportCoAuthors" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _ReportToRequestedTeams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_ReportToRequestedTeams" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _TeamManager; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_TeamManager" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _TeamToUser; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."_TeamToUser" (
    "A" text NOT NULL,
    "B" text NOT NULL
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: AnalyticsEvent AnalyticsEvent_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnalyticsEvent"
    ADD CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY (id);


--
-- Name: AnswerView AnswerView_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnswerView"
    ADD CONSTRAINT "AnswerView_pkey" PRIMARY KEY (id);


--
-- Name: Answer Answer_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Answer"
    ADD CONSTRAINT "Answer_pkey" PRIMARY KEY (id);


--
-- Name: Area Area_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Area"
    ADD CONSTRAINT "Area_pkey" PRIMARY KEY (id);


--
-- Name: DeactivatedUserTeamSnapshot DeactivatedUserTeamSnapshot_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeactivatedUserTeamSnapshot"
    ADD CONSTRAINT "DeactivatedUserTeamSnapshot_pkey" PRIMARY KEY (id);


--
-- Name: File File_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_pkey" PRIMARY KEY (id);


--
-- Name: MaintenanceMode MaintenanceMode_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MaintenanceMode"
    ADD CONSTRAINT "MaintenanceMode_pkey" PRIMARY KEY (id);


--
-- Name: NotificationView NotificationView_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationView"
    ADD CONSTRAINT "NotificationView_pkey" PRIMARY KEY (id);


--
-- Name: OrganizationTag OrganizationTag_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationTag"
    ADD CONSTRAINT "OrganizationTag_name_key" UNIQUE (name);


--
-- Name: OrganizationTag OrganizationTag_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."OrganizationTag"
    ADD CONSTRAINT "OrganizationTag_pkey" PRIMARY KEY (id);


--
-- Name: Organization Organization_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Organization"
    ADD CONSTRAINT "Organization_pkey" PRIMARY KEY (id);


--
-- Name: PendingSupervisor PendingSupervisor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PendingSupervisor"
    ADD CONSTRAINT "PendingSupervisor_pkey" PRIMARY KEY (id);


--
-- Name: PendingUser PendingUser_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PendingUser"
    ADD CONSTRAINT "PendingUser_pkey" PRIMARY KEY (id);


--
-- Name: ReportStatusHistory ReportStatusHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportStatusHistory"
    ADD CONSTRAINT "ReportStatusHistory_pkey" PRIMARY KEY (id);


--
-- Name: Report Report_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_pkey" PRIMARY KEY (id);


--
-- Name: Session Session_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_pkey" PRIMARY KEY (id);


--
-- Name: SiteBanner SiteBanner_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."SiteBanner"
    ADD CONSTRAINT "SiteBanner_pkey" PRIMARY KEY (id);


--
-- Name: Supervisor Supervisor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supervisor"
    ADD CONSTRAINT "Supervisor_pkey" PRIMARY KEY (id);


--
-- Name: TeamSpecificField TeamSpecificField_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TeamSpecificField"
    ADD CONSTRAINT "TeamSpecificField_pkey" PRIMARY KEY (id);


--
-- Name: Team Team_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_pkey" PRIMARY KEY (id);


--
-- Name: TwoFactor TwoFactor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TwoFactor"
    ADD CONSTRAINT "TwoFactor_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Verification Verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Verification"
    ADD CONSTRAINT "Verification_pkey" PRIMARY KEY (id);


--
-- Name: _AnswerToFile _AnswerToFile_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AnswerToFile"
    ADD CONSTRAINT "_AnswerToFile_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _AreaToPendingSupervisor _AreaToPendingSupervisor_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToPendingSupervisor"
    ADD CONSTRAINT "_AreaToPendingSupervisor_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _AreaToSupervisor _AreaToSupervisor_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToSupervisor"
    ADD CONSTRAINT "_AreaToSupervisor_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _AreaToTeam _AreaToTeam_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToTeam"
    ADD CONSTRAINT "_AreaToTeam_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _DeactivatedUserManagedTeams _DeactivatedUserManagedTeams_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_DeactivatedUserManagedTeams"
    ADD CONSTRAINT "_DeactivatedUserManagedTeams_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _DeactivatedUserTeams _DeactivatedUserTeams_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_DeactivatedUserTeams"
    ADD CONSTRAINT "_DeactivatedUserTeams_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _OrganizationToOrganizationTag _OrganizationToOrganizationTag_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToOrganizationTag"
    ADD CONSTRAINT "_OrganizationToOrganizationTag_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _OrganizationToPendingSupervisor _OrganizationToPendingSupervisor_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToPendingSupervisor"
    ADD CONSTRAINT "_OrganizationToPendingSupervisor_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _OrganizationToSupervisor _OrganizationToSupervisor_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToSupervisor"
    ADD CONSTRAINT "_OrganizationToSupervisor_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _OrganizationToTeamSpecificField _OrganizationToTeamSpecificField_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToTeamSpecificField"
    ADD CONSTRAINT "_OrganizationToTeamSpecificField_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _PendingManagersTeams _PendingManagersTeams_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_PendingManagersTeams"
    ADD CONSTRAINT "_PendingManagersTeams_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _PendingUsersTeams _PendingUsersTeams_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_PendingUsersTeams"
    ADD CONSTRAINT "_PendingUsersTeams_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _ReportCoAuthors _ReportCoAuthors_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ReportCoAuthors"
    ADD CONSTRAINT "_ReportCoAuthors_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _ReportToRequestedTeams _ReportToRequestedTeams_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ReportToRequestedTeams"
    ADD CONSTRAINT "_ReportToRequestedTeams_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _TeamManager _TeamManager_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_TeamManager"
    ADD CONSTRAINT "_TeamManager_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _TeamToUser _TeamToUser_AB_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_TeamToUser"
    ADD CONSTRAINT "_TeamToUser_AB_pkey" PRIMARY KEY ("A", "B");


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Account_accountId_providerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Account_accountId_providerId_key" ON public."Account" USING btree ("accountId", "providerId");


--
-- Name: AnalyticsEvent_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_createdAt_idx" ON public."AnalyticsEvent" USING btree ("createdAt");


--
-- Name: AnalyticsEvent_eventCategory_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_eventCategory_idx" ON public."AnalyticsEvent" USING btree ("eventCategory");


--
-- Name: AnalyticsEvent_eventName_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_eventName_idx" ON public."AnalyticsEvent" USING btree ("eventName");


--
-- Name: AnalyticsEvent_occurredAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_occurredAt_idx" ON public."AnalyticsEvent" USING btree ("occurredAt");


--
-- Name: AnalyticsEvent_pagePath_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_pagePath_idx" ON public."AnalyticsEvent" USING btree ("pagePath");


--
-- Name: AnalyticsEvent_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnalyticsEvent_userId_idx" ON public."AnalyticsEvent" USING btree ("userId");


--
-- Name: AnswerView_answerId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnswerView_answerId_idx" ON public."AnswerView" USING btree ("answerId");


--
-- Name: AnswerView_userId_answerId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "AnswerView_userId_answerId_key" ON public."AnswerView" USING btree ("userId", "answerId");


--
-- Name: AnswerView_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "AnswerView_userId_idx" ON public."AnswerView" USING btree ("userId");


--
-- Name: Answer_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Answer_authorId_idx" ON public."Answer" USING btree ("authorId");


--
-- Name: Answer_reportId_createdAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Answer_reportId_createdAt_idx" ON public."Answer" USING btree ("reportId", "createdAt" DESC);


--
-- Name: Answer_reportId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Answer_reportId_idx" ON public."Answer" USING btree ("reportId");


--
-- Name: Answer_reportId_isMetadataOnly_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Answer_reportId_isMetadataOnly_idx" ON public."Answer" USING btree ("reportId", "isMetadataOnly");


--
-- Name: Area_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Area_id_key" ON public."Area" USING btree (id);


--
-- Name: Area_inseeCode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Area_inseeCode_key" ON public."Area" USING btree ("inseeCode");


--
-- Name: Area_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Area_name_key" ON public."Area" USING btree (name);


--
-- Name: DeactivatedUserTeamSnapshot_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "DeactivatedUserTeamSnapshot_userId_key" ON public."DeactivatedUserTeamSnapshot" USING btree ("userId");


--
-- Name: File_reportId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "File_reportId_idx" ON public."File" USING btree ("reportId");


--
-- Name: NotificationView_type_targetId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationView_type_targetId_idx" ON public."NotificationView" USING btree (type, "targetId");


--
-- Name: NotificationView_userId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "NotificationView_userId_idx" ON public."NotificationView" USING btree ("userId");


--
-- Name: NotificationView_userId_type_targetId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "NotificationView_userId_type_targetId_key" ON public."NotificationView" USING btree ("userId", type, "targetId");


--
-- Name: Organization_id_v1_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_id_v1_key" ON public."Organization" USING btree (id_v1);


--
-- Name: Organization_shortName_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Organization_shortName_key" ON public."Organization" USING btree ("shortName");


--
-- Name: PendingSupervisor_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PendingSupervisor_email_key" ON public."PendingSupervisor" USING btree (email);


--
-- Name: PendingUser_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PendingUser_email_key" ON public."PendingUser" USING btree (email);


--
-- Name: PendingUser_verificationToken_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PendingUser_verificationToken_key" ON public."PendingUser" USING btree ("verificationToken");


--
-- Name: ReportStatusHistory_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportStatusHistory_authorId_idx" ON public."ReportStatusHistory" USING btree ("authorId");


--
-- Name: ReportStatusHistory_reportId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "ReportStatusHistory_reportId_idx" ON public."ReportStatusHistory" USING btree ("reportId");


--
-- Name: Report_authorId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_authorId_idx" ON public."Report" USING btree ("authorId");


--
-- Name: Report_lastAnswerAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_lastAnswerAt_idx" ON public."Report" USING btree ("lastAnswerAt" DESC);


--
-- Name: Report_overdueAt_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_overdueAt_idx" ON public."Report" USING btree ("overdueAt");


--
-- Name: Report_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "Report_status_idx" ON public."Report" USING btree (status);


--
-- Name: Session_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Session_token_key" ON public."Session" USING btree (token);


--
-- Name: Supervisor_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Supervisor_userId_key" ON public."Supervisor" USING btree ("userId");


--
-- Name: Team_organizationId_name_registrationNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Team_organizationId_name_registrationNumber_key" ON public."Team" USING btree ("organizationId", name, "registrationNumber") WHERE ("deletedAt" IS NULL);


--
-- Name: Team_registrationNumber_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Team_registrationNumber_key" ON public."Team" USING btree ("registrationNumber") WHERE ("deletedAt" IS NULL);


--
-- Name: TwoFactor_userId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "TwoFactor_userId_key" ON public."TwoFactor" USING btree ("userId");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_notificationFrequency_isInactive_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "User_notificationFrequency_isInactive_idx" ON public."User" USING btree ("notificationFrequency", "isInactive");


--
-- Name: _AnswerToFile_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_AnswerToFile_B_index" ON public."_AnswerToFile" USING btree ("B");


--
-- Name: _AreaToPendingSupervisor_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_AreaToPendingSupervisor_B_index" ON public."_AreaToPendingSupervisor" USING btree ("B");


--
-- Name: _AreaToSupervisor_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_AreaToSupervisor_B_index" ON public."_AreaToSupervisor" USING btree ("B");


--
-- Name: _AreaToTeam_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_AreaToTeam_B_index" ON public."_AreaToTeam" USING btree ("B");


--
-- Name: _DeactivatedUserManagedTeams_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_DeactivatedUserManagedTeams_B_index" ON public."_DeactivatedUserManagedTeams" USING btree ("B");


--
-- Name: _DeactivatedUserTeams_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_DeactivatedUserTeams_B_index" ON public."_DeactivatedUserTeams" USING btree ("B");


--
-- Name: _OrganizationToOrganizationTag_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_OrganizationToOrganizationTag_B_index" ON public."_OrganizationToOrganizationTag" USING btree ("B");


--
-- Name: _OrganizationToPendingSupervisor_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_OrganizationToPendingSupervisor_B_index" ON public."_OrganizationToPendingSupervisor" USING btree ("B");


--
-- Name: _OrganizationToSupervisor_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_OrganizationToSupervisor_B_index" ON public."_OrganizationToSupervisor" USING btree ("B");


--
-- Name: _OrganizationToTeamSpecificField_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_OrganizationToTeamSpecificField_B_index" ON public."_OrganizationToTeamSpecificField" USING btree ("B");


--
-- Name: _PendingManagersTeams_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_PendingManagersTeams_B_index" ON public."_PendingManagersTeams" USING btree ("B");


--
-- Name: _PendingUsersTeams_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_PendingUsersTeams_B_index" ON public."_PendingUsersTeams" USING btree ("B");


--
-- Name: _ReportCoAuthors_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_ReportCoAuthors_B_index" ON public."_ReportCoAuthors" USING btree ("B");


--
-- Name: _ReportToRequestedTeams_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_ReportToRequestedTeams_B_index" ON public."_ReportToRequestedTeams" USING btree ("B");


--
-- Name: _TeamManager_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_TeamManager_B_index" ON public."_TeamManager" USING btree ("B");


--
-- Name: _TeamToUser_B_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "_TeamToUser_B_index" ON public."_TeamToUser" USING btree ("B");


--
-- Name: Account Account_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnswerView AnswerView_answerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnswerView"
    ADD CONSTRAINT "AnswerView_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES public."Answer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AnswerView AnswerView_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."AnswerView"
    ADD CONSTRAINT "AnswerView_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Answer Answer_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Answer"
    ADD CONSTRAINT "Answer_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Answer Answer_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Answer"
    ADD CONSTRAINT "Answer_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public."Report"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DeactivatedUserTeamSnapshot DeactivatedUserTeamSnapshot_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DeactivatedUserTeamSnapshot"
    ADD CONSTRAINT "DeactivatedUserTeamSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: File File_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."File"
    ADD CONSTRAINT "File_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public."Report"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: NotificationView NotificationView_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."NotificationView"
    ADD CONSTRAINT "NotificationView_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ReportStatusHistory ReportStatusHistory_answerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportStatusHistory"
    ADD CONSTRAINT "ReportStatusHistory_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES public."Answer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReportStatusHistory ReportStatusHistory_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportStatusHistory"
    ADD CONSTRAINT "ReportStatusHistory_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ReportStatusHistory ReportStatusHistory_reportId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ReportStatusHistory"
    ADD CONSTRAINT "ReportStatusHistory_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES public."Report"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Report Report_applicantTeamId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_applicantTeamId_fkey" FOREIGN KEY ("applicantTeamId") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Report Report_areaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Report Report_authorId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Report Report_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Report Report_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Report"
    ADD CONSTRAINT "Report_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Session Session_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Session"
    ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Supervisor Supervisor_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Supervisor"
    ADD CONSTRAINT "Supervisor_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Team Team_organizationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Team"
    ADD CONSTRAINT "Team_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: TwoFactor TwoFactor_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."TwoFactor"
    ADD CONSTRAINT "TwoFactor_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AnswerToFile _AnswerToFile_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AnswerToFile"
    ADD CONSTRAINT "_AnswerToFile_A_fkey" FOREIGN KEY ("A") REFERENCES public."Answer"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AnswerToFile _AnswerToFile_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AnswerToFile"
    ADD CONSTRAINT "_AnswerToFile_B_fkey" FOREIGN KEY ("B") REFERENCES public."File"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AreaToPendingSupervisor _AreaToPendingSupervisor_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToPendingSupervisor"
    ADD CONSTRAINT "_AreaToPendingSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AreaToPendingSupervisor _AreaToPendingSupervisor_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToPendingSupervisor"
    ADD CONSTRAINT "_AreaToPendingSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES public."PendingSupervisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AreaToSupervisor _AreaToSupervisor_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToSupervisor"
    ADD CONSTRAINT "_AreaToSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AreaToSupervisor _AreaToSupervisor_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToSupervisor"
    ADD CONSTRAINT "_AreaToSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES public."Supervisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AreaToTeam _AreaToTeam_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToTeam"
    ADD CONSTRAINT "_AreaToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES public."Area"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _AreaToTeam _AreaToTeam_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_AreaToTeam"
    ADD CONSTRAINT "_AreaToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _DeactivatedUserManagedTeams _DeactivatedUserManagedTeams_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_DeactivatedUserManagedTeams"
    ADD CONSTRAINT "_DeactivatedUserManagedTeams_A_fkey" FOREIGN KEY ("A") REFERENCES public."DeactivatedUserTeamSnapshot"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _DeactivatedUserManagedTeams _DeactivatedUserManagedTeams_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_DeactivatedUserManagedTeams"
    ADD CONSTRAINT "_DeactivatedUserManagedTeams_B_fkey" FOREIGN KEY ("B") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _DeactivatedUserTeams _DeactivatedUserTeams_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_DeactivatedUserTeams"
    ADD CONSTRAINT "_DeactivatedUserTeams_A_fkey" FOREIGN KEY ("A") REFERENCES public."DeactivatedUserTeamSnapshot"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _DeactivatedUserTeams _DeactivatedUserTeams_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_DeactivatedUserTeams"
    ADD CONSTRAINT "_DeactivatedUserTeams_B_fkey" FOREIGN KEY ("B") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToOrganizationTag _OrganizationToOrganizationTag_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToOrganizationTag"
    ADD CONSTRAINT "_OrganizationToOrganizationTag_A_fkey" FOREIGN KEY ("A") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToOrganizationTag _OrganizationToOrganizationTag_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToOrganizationTag"
    ADD CONSTRAINT "_OrganizationToOrganizationTag_B_fkey" FOREIGN KEY ("B") REFERENCES public."OrganizationTag"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToPendingSupervisor _OrganizationToPendingSupervisor_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToPendingSupervisor"
    ADD CONSTRAINT "_OrganizationToPendingSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToPendingSupervisor _OrganizationToPendingSupervisor_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToPendingSupervisor"
    ADD CONSTRAINT "_OrganizationToPendingSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES public."PendingSupervisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToSupervisor _OrganizationToSupervisor_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToSupervisor"
    ADD CONSTRAINT "_OrganizationToSupervisor_A_fkey" FOREIGN KEY ("A") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToSupervisor _OrganizationToSupervisor_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToSupervisor"
    ADD CONSTRAINT "_OrganizationToSupervisor_B_fkey" FOREIGN KEY ("B") REFERENCES public."Supervisor"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToTeamSpecificField _OrganizationToTeamSpecificField_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToTeamSpecificField"
    ADD CONSTRAINT "_OrganizationToTeamSpecificField_A_fkey" FOREIGN KEY ("A") REFERENCES public."Organization"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _OrganizationToTeamSpecificField _OrganizationToTeamSpecificField_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_OrganizationToTeamSpecificField"
    ADD CONSTRAINT "_OrganizationToTeamSpecificField_B_fkey" FOREIGN KEY ("B") REFERENCES public."TeamSpecificField"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _PendingManagersTeams _PendingManagersTeams_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_PendingManagersTeams"
    ADD CONSTRAINT "_PendingManagersTeams_A_fkey" FOREIGN KEY ("A") REFERENCES public."PendingUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _PendingManagersTeams _PendingManagersTeams_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_PendingManagersTeams"
    ADD CONSTRAINT "_PendingManagersTeams_B_fkey" FOREIGN KEY ("B") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _PendingUsersTeams _PendingUsersTeams_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_PendingUsersTeams"
    ADD CONSTRAINT "_PendingUsersTeams_A_fkey" FOREIGN KEY ("A") REFERENCES public."PendingUser"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _PendingUsersTeams _PendingUsersTeams_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_PendingUsersTeams"
    ADD CONSTRAINT "_PendingUsersTeams_B_fkey" FOREIGN KEY ("B") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _ReportCoAuthors _ReportCoAuthors_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ReportCoAuthors"
    ADD CONSTRAINT "_ReportCoAuthors_A_fkey" FOREIGN KEY ("A") REFERENCES public."Report"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _ReportCoAuthors _ReportCoAuthors_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ReportCoAuthors"
    ADD CONSTRAINT "_ReportCoAuthors_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _ReportToRequestedTeams _ReportToRequestedTeams_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ReportToRequestedTeams"
    ADD CONSTRAINT "_ReportToRequestedTeams_A_fkey" FOREIGN KEY ("A") REFERENCES public."Report"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _ReportToRequestedTeams _ReportToRequestedTeams_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_ReportToRequestedTeams"
    ADD CONSTRAINT "_ReportToRequestedTeams_B_fkey" FOREIGN KEY ("B") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _TeamManager _TeamManager_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_TeamManager"
    ADD CONSTRAINT "_TeamManager_A_fkey" FOREIGN KEY ("A") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _TeamManager _TeamManager_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_TeamManager"
    ADD CONSTRAINT "_TeamManager_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _TeamToUser _TeamToUser_A_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_TeamToUser"
    ADD CONSTRAINT "_TeamToUser_A_fkey" FOREIGN KEY ("A") REFERENCES public."Team"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: _TeamToUser _TeamToUser_B_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."_TeamToUser"
    ADD CONSTRAINT "_TeamToUser_B_fkey" FOREIGN KEY ("B") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict HG73umjmUiIUAj9SIWrI4zB70D1w4oFoTprlVhHxw5MR9SagBCjFDEWlNLn81MZ

