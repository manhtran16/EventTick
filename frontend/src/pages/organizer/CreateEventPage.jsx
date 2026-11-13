import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '../../api/client';
import { eventsService } from '../../services/events.service';
import { useToast } from '../../context/ToastContext';
import { PATHS } from '../../routes/paths';
import {
  useEventEditorStore,
  StepIndicator,
  StepBasicInfo,
  StepSessionsTiers,
  StepSeatmap,
  StepAttendeeForm,
  StepReview,
  FormNavigation,
} from '../../features/event-editor';

/**
 * Tạo / Chỉnh sửa sự kiện (UC22, UC25, UC26) — 5 bước.
 * Quản lý trạng thái bằng Zustand store (useEventEditorStore) theo kiến trúc FSD.
 */
export default function CreateEventPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [params] = useSearchParams();

  const {
    step,
    setStep,
    setEditing,
    status,
    loading,
    setLoading,
    setSaving,
    setCategories,
    info,
    updateInfoField,
    banner,
    thumb,
    legalDoc,
    setLegalDoc,
    setHasLegalDoc,
    sessions,
    resetForm,
    initFromEvent,
    buildSchema,
    validate,
  } = useEventEditorStore();

  const structural = !editing || status === 'DRAFT';

  // Khởi tạo form khi mount hoặc khi ID đổi
  useEffect(() => {
    resetForm();
    setEditing(editing);
    if (params.get('step') === 'seatmap') {
      setStep(3);
    }
  }, [id, editing, params, resetForm, setEditing, setStep]);

  // Tải danh mục sự kiện
  useEffect(() => {
    eventsService
      .categories()
      .then((r) => {
        const list = r.categories || [];
        setCategories(list);
        if (!editing && list[0]) {
          updateInfoField('category', info.category || list[0].name);
        }
      })
      .catch(() => {});
  }, [editing, setCategories, updateInfoField, info.category]);

  // Tải dữ liệu sự kiện nếu đang ở chế độ edit
  useEffect(() => {
    if (!editing) return;
    setLoading(true);
    api
      .get(`/organizer/events/${id}`)
      .then((r) => {
        initFromEvent(r.event);
      })
      .catch((err) => {
        showToast(err.message || 'Không tải được sự kiện');
        navigate(PATHS.ORGANIZER_EVENTS);
      })
      .finally(() => setLoading(false));
  }, [editing, id, initFromEvent, navigate, setLoading, showToast]);

  const handleNext = () => {
    const err = validate(step, false);
    if (err) return showToast(err);
    setStep((s) => s + 1);
  };

  const uploadLegalDoc = async (targetEventId) => {
    const fd = new FormData();
    fd.append('document', legalDoc);
    await api.put(`/organizer/events/${targetEventId}/legal-doc`, fd);
  };

  const handleSave = async (asDraft) => {
    for (const s of [1, 2, 4]) {
      const err = validate(s, !asDraft);
      if (err) {
        setStep(s);
        return showToast(err);
      }
    }

    setSaving(true);
    try {
      if (editing) {
        const body = { description: info.description, organizerInfo: info.organizerInfo };
        if (structural) {
          Object.assign(body, {
            title: info.title.trim(),
            venueName: info.venueName.trim(),
            city: info.city.trim(),
            allowResale: info.allowResale,
            maxResaleMarkupPct: Number(info.maxResaleMarkupPct),
            customFormSchema: buildSchema(),
            ...(info.category ? { category: info.category } : {}),
          });
        }
        await api.put(`/organizer/events/${id}`, body);

        if (banner || thumb) {
          const fd = new FormData();
          if (banner) fd.append('backgroundImage', banner);
          if (thumb) fd.append('eventImage', thumb);
          await api.put(`/organizer/events/${id}/images`, fd);
        }

        if (legalDoc && ['DRAFT', 'PENDING'].includes(status)) {
          await uploadLegalDoc(id);
          setHasLegalDoc(true);
          setLegalDoc(null);
        }

        showToast('Đã lưu thay đổi');
      } else {
        const payload = {
          title: info.title.trim(),
          category: info.category,
          venueName: info.venueName.trim(),
          city: info.city.trim(),
          description: info.description,
          organizerInfo: info.organizerInfo,
          allowResale: info.allowResale,
          maxResaleMarkupPct: Number(info.maxResaleMarkupPct),
          customFormSchema: buildSchema(),
          saveAsDraft: true,
          sessions: sessions.map((s) => ({
            name: s.name.trim() || undefined,
            startTime: new Date(s.startTime).toISOString(),
            endTime: s.endTime ? new Date(s.endTime).toISOString() : undefined,
            tickets: s.tiers.map((t) => ({
              name: t.name.trim(),
              price: Number(t.price),
              totalQuantity: Number(t.quantity),
              zoneType: t.zoneType,
              zoneColor: t.color,
              minPerOrder: Number(t.minPerOrder),
              maxPerOrder: Number(t.maxPerOrder),
            })),
          })),
        };

        const fd = new FormData();
        fd.append('data', JSON.stringify(payload));
        if (banner) fd.append('backgroundImage', banner);
        if (thumb) fd.append('eventImage', thumb);
        const r = await api.post('/events', fd);
        const newId = r.eventId;

        if (legalDoc) {
          try {
            await uploadLegalDoc(newId);
          } catch (err) {
            showToast(`Đã lưu nháp nhưng chưa tải được giấy phép: ${err.message}`);
            navigate(`/organizer/events/${newId}/edit`, { replace: true });
            return;
          }
        }

        if (!asDraft) {
          try {
            await api.post(`/organizer/events/${newId}/submit`, {});
            showToast('Đã gửi Admin duyệt');
            navigate(PATHS.ORGANIZER_EVENTS);
          } catch (err) {
            showToast(`Đã lưu nháp nhưng chưa gửi duyệt được: ${err.message}`);
            navigate(`/organizer/events/${newId}/edit`, { replace: true });
          }
          return;
        }

        showToast(r.message || 'Đã lưu bản nháp');
        navigate(`/organizer/events/${newId}/edit?step=seatmap`, { replace: true });
        return;
      }
      navigate(PATHS.ORGANIZER_EVENTS);
    } catch (err) {
      showToast(err.message || 'Không lưu được sự kiện');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className='text-[#71717a] flex items-center gap-2 py-10'>
        <Loader2 size={16} className='animate-spin' /> Đang tải...
      </div>
    );
  }

  return (
    <div className='max-w-4xl space-y-6'>
      <div>
        <h1 className='text-2xl font-bold tracking-tight'>
          {editing ? 'Chỉnh sửa sự kiện' : 'Tạo sự kiện mới'}
        </h1>
        {editing && !structural && (
          <p className='text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2'>
            Sự kiện đã {status === 'PENDING' ? 'gửi duyệt' : 'được duyệt'}, chỉ sửa được mô tả và thông tin tổ chức.
            {status === 'PENDING' && ' Hãy rút lại về bản nháp nếu cần sửa nhiều hơn.'}
          </p>
        )}
      </div>

      <StepIndicator />

      <div className='bg-white border border-[#e4e4e7] rounded-2xl p-6 space-y-5'>
        {step === 1 && <StepBasicInfo />}
        {step === 2 && <StepSessionsTiers />}
        {step === 3 && <StepSeatmap eventId={id} />}
        {step === 4 && <StepAttendeeForm />}
        {step === 5 && <StepReview />}
      </div>

      <FormNavigation onNext={handleNext} onSave={handleSave} />
    </div>
  );
}
