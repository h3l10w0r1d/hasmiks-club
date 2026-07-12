import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, LinkIcon, ImageUp, Undo, Redo,
} from 'lucide-react'
import { Button } from './button'

function ToolbarButton({ onClick, active, disabled, title, children }) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className="h-8 w-8 p-0"
      onMouseDown={e => e.preventDefault()} // keep editor selection/focus while clicking toolbar
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </Button>
  )
}

// Uncontrolled by design: `initialContent` seeds the document once per mount.
// Pass a `key` from the parent (e.g. editingItem?.id ?? 'new') to force a
// remount — and therefore a content reset — when switching what's being
// edited, the same way a plain <textarea defaultValue> would be reset.
export default function RichTextEditor({ initialContent = '', onChange, onUploadImage }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Image.configure({ HTMLAttributes: { style: 'max-width:100%;border-radius:8px' } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    editorProps: {
      attributes: { class: 'rte-content' },
    },
  })

  if (!editor) return null

  const handleImageFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !onUploadImage) return
    setUploading(true)
    try {
      const res = await onUploadImage(file)
      editor.chain().focus().setImage({ src: res.url }).run()
    } catch { /* ignore — same silent-fail convention as ImageUploadField */ }
    finally { setUploading(false); e.target.value = '' }
  }

  const setLink = () => {
    const prev = editor.getAttributes('link').href
    const url = window.prompt('Link URL', prev || 'https://')
    if (url === null) return
    if (url === '') { editor.chain().focus().unsetLink().run(); return }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className="rte-wrap border rounded-md overflow-hidden bg-white">
      <div className="flex items-center gap-0.5 flex-wrap border-b bg-muted/30 p-1">
        <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-3.5 w-3.5" /></ToolbarButton>
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-3.5 w-3.5" /></ToolbarButton>
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-3.5 w-3.5" /></ToolbarButton>
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon className="h-3.5 w-3.5" /></ToolbarButton>
        {onUploadImage && (
          <>
            <ToolbarButton title="Insert image" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <ImageUp className="h-3.5 w-3.5" />
            </ToolbarButton>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
          </>
        )}
        <span className="w-px h-5 bg-border mx-1" />
        <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()}><Undo className="h-3.5 w-3.5" /></ToolbarButton>
        <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()}><Redo className="h-3.5 w-3.5" /></ToolbarButton>
      </div>
      <EditorContent editor={editor} className="px-3 py-2 text-sm min-h-[120px] max-h-[360px] overflow-y-auto" />
    </div>
  )
}
