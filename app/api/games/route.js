import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('search');
    
    if (!query) {
        return NextResponse.json({ error: 'Search query is required' }, { status: 400 });
    }

    const apiKey = process.env.RAWG_API_KEY;
    
    if (!apiKey) {
        return NextResponse.json({ error: 'API key is not configured on the server' }, { status: 500 });
    }

    try {
        const res = await fetch(`https://api.rawg.io/api/games?search=${encodeURIComponent(query)}&key=${apiKey}&page_size=5`);
        
        if (!res.ok) {
            throw new Error(`RAWG API error: ${res.status}`);
        }
        
        const data = await res.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error('Search error:', err);
        return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
    }
}
