const parseTime = (time: string = ''): number => {
  time = time.trim().replaceAll(/(\[|\])/g, '')
  const [minutes, seconds] = time.split(':')
  return Math.floor((Number(minutes) * 60 + Number(seconds)) * 1000)
}

const parseLyrics = (lyrics: string): { time: number; content: string }[] => {
  const lines = lyrics.trim().split('\n')
  const parsedLines = lines.map((line) => {
    const [time, content = ''] = line.trim().split(/(?<=\[\d\d:\d\d.\d\d\])/g)
    return {
      time: parseTime(time),
      content: content.trim()
    }
  })

  parsedLines.push({ time: Infinity, content: '%end%' })

  return parsedLines
}

export default parseLyrics
