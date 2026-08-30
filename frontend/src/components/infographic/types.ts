export interface InfographicStat {
  value: string
  label: string
}

export interface InfographicSection {
  title: string
  icon?: string
  points: string[]
}

export interface InfographicData {
  title: string
  subtitle?: string
  severity?: 'HIGH' | 'MEDIUM' | 'LOW' | 'CRITICAL' | string
  keyMessage: string
  statistics: InfographicStat[]
  sections: InfographicSection[]
  recommendations: string[]
  footer?: string
  visualRecommendations?: string[]
}

export function parseInfographicData(rawContent: string): InfographicData {
  if (!rawContent || typeof rawContent !== 'string') {
    return getDefaultInfographicData()
  }

  const trimmed = rawContent.trim()

  // 1. Try parsing JSON if content starts with { or ```json
  if (trimmed.startsWith('{') || trimmed.startsWith('```json') || trimmed.includes('"title":')) {
    try {
      const jsonString = trimmed
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/\s*```$/, '')
      const parsed = JSON.parse(jsonString)
      if (parsed && typeof parsed === 'object') {
        return {
          title: parsed.title || 'Security & Threat Briefing',
          subtitle: parsed.subtitle || 'Incident Overview & Response Strategy',
          severity: parsed.severity || 'HIGH',
          keyMessage: parsed.keyMessage || 'Rapid isolation, continuous monitoring, and verified backups mitigate threat impact.',
          statistics: Array.isArray(parsed.statistics) ? parsed.statistics : getDefaultInfographicData().statistics,
          sections: Array.isArray(parsed.sections) ? parsed.sections : getDefaultInfographicData().sections,
          recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : getDefaultInfographicData().recommendations,
          footer: parsed.footer || 'TransformAI Security Intelligence Briefing · Official Advisory',
          visualRecommendations: Array.isArray(parsed.visualRecommendations) ? parsed.visualRecommendations : [],
        }
      }
    } catch (_) {
      // Fallback to markdown parsing below
    }
  }

  // 2. Markdown Parser for generated structured text
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)

  let title = ''
  let subtitle = 'Incident Overview & Operational Response'
  let severity = 'HIGH'
  let keyMessage = ''
  const statistics: InfographicStat[] = []
  const sections: InfographicSection[] = []
  const recommendations: string[] = []
  let footer = 'TransformAI Security Intelligence Briefing · Official Advisory'

  let currentSectionTitle = ''
  let currentPoints: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Title parsing
    if (!title && (/^#\s+/.test(line) || /^Title:\s*/i.test(line))) {
      title = line.replace(/^#+\s*/, '').replace(/^Title:\s*/i, '').replace(/\*+/g, '')
      continue
    }

    // Subtitle parsing
    if (line.toLowerCase().includes('subtitle:') || line.toLowerCase().includes('tagline:')) {
      subtitle = line.replace(/.*(?:subtitle|tagline):\s*/i, '').replace(/\*+/g, '')
      continue
    }

    // Severity parsing
    const severityMatch = line.match(/(?:severity|risk level):\s*(HIGH|CRITICAL|MEDIUM|LOW)/i)
    if (severityMatch) {
      severity = severityMatch[1].toUpperCase()
    }

    // Core Storyline / Key Message parsing
    if (/core storyline|key message|headline/i.test(line)) {
      const colonIdx = line.indexOf(':')
      if (colonIdx !== -1 && line.substring(colonIdx + 1).trim()) {
        keyMessage = line.substring(colonIdx + 1).replace(/\*+/g, '').trim()
      } else if (i + 1 < lines.length && !lines[i + 1].startsWith('#')) {
        keyMessage = lines[i + 1].replace(/\*+/g, '').trim()
        i++
      }
      continue
    }

    // Statistics parsing
    if (line.toLowerCase().includes('statistic') || line.toLowerCase().includes('key callout statistics')) {
      let j = i + 1
      while (j < lines.length && !lines[j].startsWith('#') && (lines[j].startsWith('-') || lines[j].startsWith('*') || /^\d+\./.test(lines[j]))) {
        const statLine = lines[j].replace(/^[\-\*\d\.]+\s*/, '').trim()
        const boldMatch = statLine.match(/\*\*([^\*]+)\*\*:\s*(.*)/) || statLine.match(/([^\:]+):\s*(.*)/)
        if (boldMatch) {
          statistics.push({
            value: boldMatch[1].replace(/[^0-9A-Za-z%<>\+\-\s]/g, '').trim(),
            label: boldMatch[2].replace(/\*+/g, '').trim() || boldMatch[1].trim(),
          })
        }
        j++
      }
      if (statistics.length > 0) {
        i = j - 1
        continue
      }
    }

    // Recommendations parsing
    if (/recommendation|actionable guidance|call to action/i.test(line)) {
      let j = i + 1
      while (j < lines.length && !lines[j].startsWith('#')) {
        const recLine = lines[j].replace(/^[\-\*\d\.]+\s*/, '').replace(/\*+/g, '').trim()
        if (recLine && recLine.length > 4) {
          recommendations.push(recLine)
        }
        j++
      }
      if (recommendations.length > 0) {
        i = j - 1
        continue
      }
    }

    // Generic Section Parsing
    if (/^#{2,4}\s+/.test(line)) {
      if (currentSectionTitle && currentPoints.length > 0) {
        sections.push({ title: currentSectionTitle, points: [...currentPoints] })
      }
      currentSectionTitle = line.replace(/^#+\s*/, '').replace(/\*+/g, '').trim()
      currentPoints = []
      continue
    }

    if (currentSectionTitle && (line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))) {
      const pt = line.replace(/^[\-\*\d\.]+\s*/, '').replace(/\*+/g, '').trim()
      if (pt) currentPoints.push(pt)
    }
  }

  if (currentSectionTitle && currentPoints.length > 0) {
    sections.push({ title: currentSectionTitle, points: currentPoints })
  }

  const defaults = getDefaultInfographicData()

  return {
    title: title || defaults.title,
    subtitle: subtitle || defaults.subtitle,
    severity: severity || defaults.severity,
    keyMessage: keyMessage || defaults.keyMessage,
    statistics: statistics.length > 0 ? statistics : defaults.statistics,
    sections: sections.length > 0 ? sections : defaults.sections,
    recommendations: recommendations.length > 0 ? recommendations : defaults.recommendations,
    footer: footer || defaults.footer,
  }
}

export function getDefaultInfographicData(): InfographicData {
  return {
    title: '',
    subtitle: '',
    severity: '',
    keyMessage: '',
    statistics: [],
    sections: [],
    recommendations: [],
    footer: '',
    visualRecommendations: [],
  }
}
