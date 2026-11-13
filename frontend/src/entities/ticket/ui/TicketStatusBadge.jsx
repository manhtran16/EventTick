export default function TicketStatusBadge({ rawStatus, status }) {
  const getBadgeStyle = () => {
    if (rawStatus === 'VALID') {
      return {
        container: 'bg-[#09090b] text-white border border-[#09090b]',
        dot: 'bg-white',
      };
    }
    if (rawStatus === 'LISTED_RESALE') {
      return {
        container: 'bg-[#f4f4f6] text-[#09090b] border border-[#e4e4e7]',
        dot: 'bg-[#71717a]',
      };
    }
    return {
      container: 'bg-[#f4f4f6] text-[#71717a] border border-[#e4e4e7]',
      dot: 'bg-[#71717a]',
    };
  };

  const style = getBadgeStyle();

  return (
    <span
      className={`text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 ${style.container}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{status}</span>
    </span>
  );
}
