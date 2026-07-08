import { useState, useCallback, useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { UploadCloud, Trash2, Crop, Star, GripVertical, Check, X, Pencil } from 'lucide-react'
import CropModal from './CropModal'
import {
  adminAddPhotosBulk, adminUpdatePhoto, adminDeletePhoto, adminReorderPhotos, adminUpdateAlbum,
  adminUploadGalleryPhoto,
} from '../api/admin'

function PhotoThumb({ photo, isCover, onCrop, onSetCover, onDelete, onCaptionSave }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: photo.id })
  const [editingCaption, setEditingCaption] = useState(false)
  const [captionDraft, setCaptionDraft] = useState(photo.caption || '')

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const saveCaption = () => {
    setEditingCaption(false)
    if (captionDraft !== (photo.caption || '')) onCaptionSave(photo, captionDraft)
  }

  return (
    <div ref={setNodeRef} style={style} className="relative group rounded-lg overflow-hidden border border-border bg-white">
      <div className="relative">
        <img src={photo.url} alt={photo.caption || ''} className="w-full h-32 object-cover" />
        <button
          {...attributes} {...listeners}
          className="absolute top-1.5 left-1.5 bg-black/55 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          title="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {isCover && (
          <span className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-1">
            <Star className="h-2.5 w-2.5 fill-current" /> Cover
          </span>
        )}
        <div className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="bg-black/55 text-white rounded p-1 hover:bg-black/75" onClick={() => onCrop(photo)} title="Crop">
            <Crop className="h-3 w-3" />
          </button>
          {!isCover && (
            <button className="bg-black/55 text-white rounded p-1 hover:bg-black/75" onClick={() => onSetCover(photo)} title="Set as cover">
              <Star className="h-3 w-3" />
            </button>
          )}
          <button className="bg-black/55 text-white rounded p-1 hover:bg-red-600" onClick={() => onDelete(photo)} title="Delete">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="px-2 py-1.5">
        {editingCaption ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus value={captionDraft} onChange={e => setCaptionDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveCaption(); if (e.key === 'Escape') { setEditingCaption(false); setCaptionDraft(photo.caption || '') } }}
              className="flex-1 min-w-0 text-xs border border-input rounded px-1.5 py-0.5"
              placeholder="Caption…"
            />
            <button onClick={saveCaption} className="text-emerald-600 flex-shrink-0"><Check className="h-3.5 w-3.5" /></button>
            <button onClick={() => { setEditingCaption(false); setCaptionDraft(photo.caption || '') }} className="text-muted-foreground flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
          </div>
        ) : (
          <button onClick={() => setEditingCaption(true)} className="w-full text-left text-xs text-muted-foreground truncate flex items-center gap-1 hover:text-foreground">
            {photo.caption ? <span className="truncate">{photo.caption}</span> : <span className="italic opacity-60">Add caption…</span>}
            <Pencil className="h-2.5 w-2.5 flex-shrink-0 opacity-0 group-hover:opacity-100" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function GalleryManager({ album, onAlbumChange, flash }) {
  const [photos, setPhotos] = useState(album.photos || [])
  const [uploading, setUploading] = useState(false)
  const [cropQueue, setCropQueue] = useState(null) // { photo, src } for re-cropping an existing photo

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return
    setUploading(true)
    try {
      const created = await adminAddPhotosBulk(album.id, acceptedFiles)
      setPhotos(p => [...p, ...created])
      onAlbumChange({ photo_count: (album.photo_count || 0) + created.length, cover_url: album.cover_url || created[0]?.url })
      flash(`${created.length} photo${created.length !== 1 ? 's' : ''} added`)
    } catch {
      flash('Some photos failed to upload', true)
    } finally {
      setUploading(false)
    }
  }, [album, onAlbumChange, flash])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [] }, multiple: true,
  })

  const handleDragEnd = async (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = photos.findIndex(p => p.id === active.id)
    const newIndex = photos.findIndex(p => p.id === over.id)
    const reordered = arrayMove(photos, oldIndex, newIndex)
    setPhotos(reordered)
    try {
      await adminReorderPhotos(album.id, reordered.map(p => p.id))
    } catch {
      flash('Could not save new order', true)
    }
  }

  const handleDelete = async (photo) => {
    await adminDeletePhoto(photo.id)
    setPhotos(p => p.filter(x => x.id !== photo.id))
    onAlbumChange({ photo_count: Math.max((album.photo_count || 1) - 1, 0) })
    flash('Photo deleted')
  }

  const handleSetCover = async (photo) => {
    await adminUpdateAlbum(album.id, { cover_url: photo.url })
    onAlbumChange({ cover_url: photo.url })
    flash('Cover updated')
  }

  const handleCaptionSave = async (photo, caption) => {
    const updated = await adminUpdatePhoto(photo.id, { caption })
    setPhotos(p => p.map(x => x.id === photo.id ? updated : x))
  }

  const handleCropSave = async (blob) => {
    const { photo } = cropQueue
    setCropQueue(null)
    const file = new File([blob], 'cropped.jpg', { type: 'image/jpeg' })
    setUploading(true)
    try {
      const { url } = await adminUploadGalleryPhoto(file)
      const updated = await adminUpdatePhoto(photo.id, { url })
      setPhotos(p => p.map(x => x.id === photo.id ? updated : x))
      if (album.cover_url === photo.url) onAlbumChange({ cover_url: url })
      flash('Photo updated')
    } catch {
      flash('Crop failed to save', true)
    } finally {
      setUploading(false)
    }
  }

  const ids = useMemo(() => photos.map(p => p.id), [photos])

  return (
    <div className="border-t border-border bg-muted/30 p-5 space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50'}`}
      >
        <input {...getInputProps()} />
        <UploadCloud className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {uploading ? 'Uploading…' : isDragActive ? 'Drop photos here' : 'Drag & drop photos, or click to select (multiple allowed)'}
        </p>
      </div>

      {photos.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-2">No photos yet. Drop some above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {photos.map(photo => (
                <PhotoThumb
                  key={photo.id}
                  photo={photo}
                  isCover={album.cover_url === photo.url}
                  onCrop={p => setCropQueue({ photo: p, src: p.url })}
                  onSetCover={handleSetCover}
                  onDelete={handleDelete}
                  onCaptionSave={handleCaptionSave}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {cropQueue && (
        <CropModal
          imageSrc={cropQueue.src}
          aspect={null}
          onCancel={() => setCropQueue(null)}
          onConfirm={handleCropSave}
        />
      )}
    </div>
  )
}
