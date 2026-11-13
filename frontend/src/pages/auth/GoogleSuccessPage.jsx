import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PATHS, getRoleHomePath } from '../../routes/paths';

// Google redirect về đây sau khi backend đã xác thực và cấp token
export default function GoogleSuccessPage() {
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
    }

    refreshUser().then((u) => {
      if (!alive) return;
      if (u) {
        showToast('Đăng nhập thành công');
        navigate(getRoleHomePath(u.role), { replace: true });
      } else {
        navigate(`${PATHS.LOGIN}?error=server_error`, { replace: true });
      }
    });
    return () => {
      alive = false;
    };
  }, [searchParams, refreshUser, showToast, navigate]);

  return <div className='py-24 text-center text-sm text-[#71717a]'>Đang hoàn tất đăng nhập...</div>;
}
