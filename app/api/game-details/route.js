import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
        return NextResponse.json({ error: 'Game ID is required' }, { status: 400 });
    }

    const clientId = process.env.IGDB_CLIENT_ID;
    const clientSecret = process.env.IGDB_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
        return NextResponse.json({ error: 'IGDB credentials are not configured on the server' }, { status: 500 });
    }

    try {
        let accessToken = null;
        if (redis) {
            accessToken = await redis.get('igdb_access_token');
        }

        if (!accessToken) {
            const tokenRes = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`, {
                method: 'POST'
            });
            
            if (!tokenRes.ok) {
                throw new Error('Failed to fetch Twitch OAuth token');
            }
            
            const tokenData = await tokenRes.json();
            accessToken = tokenData.access_token;
            
            if (redis) {
                await redis.set('igdb_access_token', accessToken, { ex: 50 * 24 * 60 * 60 });
            }
        }

        const igdbRes = await fetch('https://api.igdb.com/v4/games', {
            method: 'POST',
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'Content-Type': 'text/plain'
            },
            body: `fields name, summary, first_release_date, total_rating, genres.name, cover.url; where id = ${id};`
        });

        if (!igdbRes.ok) {
            throw new Error('Failed to fetch game details from IGDB');
        }

        const data = await igdbRes.json();
        
        if (data && data.length > 0) {
            return NextResponse.json(data[0]);
        } else {
            return NextResponse.json({ error: 'Game not found' }, { status: 404 });
        }

    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
