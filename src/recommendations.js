import Groq from 'groq-sdk';

export async function getRecommendations(albums) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const albumList = albums
    .map((a) => `- "${a.name}" by ${a.artists.join(', ')}`)
    .join('\n');

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `I'm doing an "Album a Day" challenge in 2026 where I listen to a new album every day.
Here are the albums already in my playlist:

${albumList}

Based on this listening history, recommend 10 albums I haven't listened to yet.

Respond with ONLY a valid JSON array, no markdown, no explanation. Each item must have:
- "album": album title
- "artist": artist name
- "year": release year as a number
- "similar_artists": array of 2 artist names from my playlist that are similar

Example format:
[{"album":"Title","artist":"Name","year":2001,"similar_artists":["Artist A","Artist B"]}]`,
      },
    ],
  });

  const raw = completion.choices[0].message.content.trim();
  // Strip markdown code fences if the model wraps it anyway
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(json);
}
