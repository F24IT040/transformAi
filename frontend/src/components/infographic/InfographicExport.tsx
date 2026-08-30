import { useState } from 'react'
import { toPng, toJpeg, toBlob } from 'html-to-image'

interface Props {
  targetRef: React.RefObject<HTMLDivElement | null>
  mode: 'preview' | 'edit'
  setMode: (m: 'preview' | 'edit') => void
  onNotice?: (msg: string) => void
}

export function InfographicExport({ targetRef, mode, setMode, onNotice }: Props) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')

  const handleExport = async (format: 'png' | 'jpeg') => {
    const el = targetRef.current
    if (!el) {
      onNotice?.('Infographic poster target not found.')
      return
    }

    setIsExporting(true)
    setExportMessage('Preparing high-resolution image...')

    try {
      // Options for 2x scale crisp resolution export
      const options = {
        quality: 0.95,
        pixelRatio: 2,
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      }

      let dataUrl = ''
      if (format === 'png') {
        dataUrl = await toPng(el, options)
      } else {
        dataUrl = await toJpeg(el, options)
      }

      const link = document.createElement('a')
      link.download = `transformai_infographic_${Date.now()}.${format === 'jpeg' ? 'jpg' : 'png'}`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      setExportMessage('✓ Image exported successfully')
      onNotice?.(`✓ Infographic exported cleanly as ${format.toUpperCase()}!`)
    } catch (err) {
      console.error('Export image error:', err)
      setExportMessage('Export failed')
      onNotice?.('Image export failed. Please try again.')
    } finally {
      setTimeout(() => {
        setIsExporting(false)
        setExportMessage('')
      }, 3500)
    }
  }

  const handleCopyImage = async () => {
    const el = targetRef.current
    if (!el) return

    setIsExporting(true)
    setExportMessage('Copying image to clipboard...')

    try {
      const blob = await toBlob(el, { quality: 0.95, pixelRatio: 2 })
      if (!blob) throw new Error('Failed to generate image blob')

      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob }),
        ])
        setExportMessage('✓ Copied image to clipboard!')
        onNotice?.('✓ Infographic graphic copied to clipboard!')
      } else {
        throw new Error('ClipboardItem API not supported in this browser')
      }
    } catch (err: any) {
      console.warn('Copy to clipboard failed, falling back to download PNG:', err)
      handleExport('png')
    } finally {
      setTimeout(() => {
        setIsExporting(false)
        setExportMessage('')
      }, 3500)
    }
  }

  return (
    <div className="infographic-controls-bar">
      <div className="mode-toggle-group">
        <button
          type="button"
          className={`mode-toggle-btn ${mode === 'preview' ? 'active' : ''}`}
          onClick={() => setMode('preview')}
        >
          👁 Visual Preview
        </button>
        <button
          type="button"
          className={`mode-toggle-btn ${mode === 'edit' ? 'active' : ''}`}
          onClick={() => setMode('edit')}
        >
          ✏️ Edit Infographic Content
        </button>
      </div>

      <div className="export-actions-group">
        {exportMessage ? (
          <div className="export-status-toast">{exportMessage}</div>
        ) : null}

        <button
          type="button"
          className="export-btn primary-export"
          disabled={isExporting}
          onClick={() => handleExport('png')}
        >
          {isExporting ? 'Preparing...' : '📸 Export PNG Image'}
        </button>

        <button
          type="button"
          className="export-btn"
          disabled={isExporting}
          onClick={() => handleExport('jpeg')}
        >
          Export JPG
        </button>

        <button
          type="button"
          className="export-btn"
          disabled={isExporting}
          onClick={handleCopyImage}
          title="Copy graphic directly to clipboard"
        >
          📋 Copy Image
        </button>
      </div>
    </div>
  )
}
