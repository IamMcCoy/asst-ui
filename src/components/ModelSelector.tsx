import { FC, useState } from 'react';
import { Popover } from '@mui/material';
import { IconSparkle, IconCheck } from './icons';
import './Overlay.css';

interface ModelSelectorProps {
    models: string[];
    selectedModel: string | null;
    onModelChange: (model: string | null) => void;
    disabled?: boolean;
    loading?: boolean;
    renderTrigger: (open: (e: React.MouseEvent<HTMLElement>) => void, isOpen: boolean, label: string) => React.ReactNode;
}

// MUI Popover는 앵커 포지셔닝 / portal / click-away / Esc 만 담당하고,
// 보이는 것은 Overlay.css의 .ov-* 프리미티브로 그린다 (Composer/SessionSidebar와 같은 치수).
export const ModelSelector: FC<ModelSelectorProps> = ({
    models,
    selectedModel,
    onModelChange,
    disabled = false,
    loading = false,
    renderTrigger,
}) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (disabled || loading) return;
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleSelect = (model: string) => {
        onModelChange(model);
        handleClose();
    };

    const displayLabel = selectedModel
        ? selectedModel.length > 16
            ? selectedModel.slice(0, 16) + '…'
            : selectedModel
        : '모델 선택';

    return (
        <>
            {renderTrigger(handleClick, open, displayLabel)}

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                // Paper는 껍데기로만 쓴다 — 배경/테두리/그림자는 .ov-pop이 그린다
                PaperProps={{ sx: { bgcolor: 'transparent', backgroundImage: 'none', boxShadow: 'none', borderRadius: 'var(--r-md)' } }}
            >
                <div className="ov-pop" style={{ maxHeight: 360 }}>
                    <div className="ov-head">
                        <IconSparkle className="ic-sm" />
                        <div className="ov-head-text">
                            <span className="ov-title">모델 선택</span>
                        </div>
                        <span className="ov-head-spacer" />
                        <span className="mono-label">{models.length}</span>
                    </div>

                    <div className="ov-body tight">
                        {models.length === 0 ? (
                            <div className="ov-empty">사용 가능한 모델이 없습니다</div>
                        ) : (
                            <div className="ov-list">
                                {models.map((model) => (
                                    <button
                                        key={model}
                                        type="button"
                                        className={'ov-item' + (selectedModel === model ? ' active' : '')}
                                        onClick={() => handleSelect(model)}
                                    >
                                        <span className="ov-item-name" title={model}>{model}</span>
                                        {selectedModel === model && <IconCheck className="ic-sm ic-check" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Popover>
        </>
    );
};
