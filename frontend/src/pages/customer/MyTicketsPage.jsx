/* Hallmark · pre-emit critique: P5 H5 E5 S4 R5 V5 */
import { useEffect, useMemo } from 'react';
import { useToast } from '../../context/ToastContext';
import { useTicketStore } from '../../entities/ticket';
import { TicketList } from '../../widgets/ticket-list';
import { TicketQrModal, TicketCheckInSuccessModal, TicketPrintView } from '../../features/ticket-checkin';
import { ResaleListingModal } from '../../features/ticket-resale';

export default function MyTicketsPage() {
  const {
    tickets,
    loading,
    activeTab,
    selectedTicket,
    customerCheckInSuccess,
    resaleModalTicket,
    setActiveTab,
    setSelectedTicket,
    setCustomerCheckInSuccess,
    setResaleModalTicket,
    closeAllModals,
    fetchTickets,
    handleCancelResale,
  } = useTicketStore();

  const { showToast } = useToast();

  useEffect(() => {
    fetchTickets(showToast);
  }, [fetchTickets, showToast]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeAllModals]);

  const filteredTickets = useMemo(() => {
    if (activeTab === 'ALL') return tickets;
    if (activeTab === 'UPCOMING') return tickets.filter((t) => t.validity === 'UPCOMING' && t.rawStatus === 'VALID');
    if (activeTab === 'RESALE') return tickets.filter((t) => t.rawStatus === 'LISTED_RESALE');
    if (activeTab === 'USED') return tickets.filter((t) => t.rawStatus === 'USED');
    return tickets;
  }, [tickets, activeTab]);

  const handlePrint = (ticket) => {
    setSelectedTicket(ticket);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const handleCheckInSuccess = (updatedTicketData) => {
    setSelectedTicket(null);
    setCustomerCheckInSuccess(updatedTicketData);
    fetchTickets(showToast);
  };

  return (
    <div className='max-w-5xl mx-auto py-10 px-4'>
      <TicketList
        tickets={tickets}
        filteredTickets={filteredTickets}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        loading={loading}
        onViewQr={setSelectedTicket}
        onPrint={handlePrint}
        onOpenResale={setResaleModalTicket}
        onCancelResale={(id) => handleCancelResale(id, showToast)}
      />

      {/* Feature Modals */}
      <TicketQrModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onCheckInSuccess={handleCheckInSuccess}
        onPrint={handlePrint}
      />

      <TicketCheckInSuccessModal
        data={customerCheckInSuccess}
        onClose={() => setCustomerCheckInSuccess(null)}
      />

      <ResaleListingModal
        ticket={resaleModalTicket}
        onClose={() => setResaleModalTicket(null)}
        onSuccess={() => fetchTickets(showToast)}
      />

      <TicketPrintView ticket={selectedTicket} />
    </div>
  );
}
