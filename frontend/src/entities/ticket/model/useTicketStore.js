import { create } from 'zustand';
import api from '../../../api/client';

export const useTicketStore = create((set, get) => ({
  tickets: [],
  loading: true,
  activeTab: 'ALL',
  selectedTicket: null,
  customerCheckInSuccess: null,
  resaleModalTicket: null,

  setTickets: (tickets) => set({ tickets }),
  setLoading: (loading) => set({ loading }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSelectedTicket: (selectedTicket) => set({ selectedTicket }),
  setCustomerCheckInSuccess: (customerCheckInSuccess) => set({ customerCheckInSuccess }),
  setResaleModalTicket: (resaleModalTicket) => set({ resaleModalTicket }),

  closeAllModals: () =>
    set({
      selectedTicket: null,
      customerCheckInSuccess: null,
      resaleModalTicket: null,
    }),

  fetchTickets: async (showToast) => {
    try {
      set({ loading: true });
      const res = await api.get('/booking/user/tickets');
      set({ tickets: res.tickets || [] });
    } catch (err) {
      showToast?.(err.message || 'Không thể tải danh sách vé của bạn');
    } finally {
      set({ loading: false });
    }
  },

  handleCancelResale: async (listingId, showToast) => {
    if (!window.confirm('Bạn có chắc muốn hủy tin bán lại và lấy lại vé?')) return;
    try {
      const res = await api.delete(`/resale/listings/${listingId}`);
      showToast?.(res.message || (res.cancelRequested ? 'Yêu cầu hủy đã được ghi nhận' : 'Đã hủy tin bán lại vé'));
      get().fetchTickets(showToast);
    } catch (err) {
      showToast?.(err.message || 'Không thể hủy tin bán lại');
    }
  },
}));
