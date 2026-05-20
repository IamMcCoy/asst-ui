import { FC, useState } from 'react';
import { UploadedFile } from '../types/api';
import { IconFile, IconX } from './icons';
import './SessionFiles.css';

interface SessionFilesProps {
    files: UploadedFile[];
    onDelete: (fileId: string) => Promise<void> | void;
}

export const SessionFiles: FC<SessionFilesProps> = ({ files, onDelete }) => {
    const [pendingDelete, setPendingDelete] = useState<string | null>(null);

    if (files.length === 0) return null;

    const handleDelete = async (fileId: string) => {
        if (pendingDelete) return;
        setPendingDelete(fileId);
        try {
            await onDelete(fileId);
        } finally {
            setPendingDelete(null);
        }
    };

    return (
        <div className="session-files">
            {files.map((f) => (
                <div className="file-chip" key={f.file_id} title={f.filename}>
                    <IconFile className="ic-sm" />
                    <span className="file-chip-name">{f.filename}</span>
                    <button
                        type="button"
                        className="file-chip-x"
                        onClick={() => handleDelete(f.file_id)}
                        disabled={pendingDelete === f.file_id}
                        aria-label={`${f.filename} 삭제`}
                    >
                        <IconX className="ic-sm" />
                    </button>
                </div>
            ))}
        </div>
    );
};
