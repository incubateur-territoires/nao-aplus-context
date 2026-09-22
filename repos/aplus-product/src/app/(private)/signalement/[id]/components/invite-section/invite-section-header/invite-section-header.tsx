interface InviteSectionHeaderProps {
  showColleaguesToInvite: boolean;
}

export function InviteSectionHeader({}: InviteSectionHeaderProps) {
  return (
    <h2 className="text-[32px] font-bold leading-[40px] text-[#161616] m-0">
      Inviter d&apos;autres utilisateurs
    </h2>
  );
}
