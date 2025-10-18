import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(req: NextRequest) {
  try {
    // Check if API key exists
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not found in environment variables')
      return NextResponse.json(
        { 
          success: false,
          error: 'OpenAI API key not configured' 
        }, 
        { status: 500 }
      )
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })

    const { prompt } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    console.log('Generating image with DALL-E 3:', { prompt: prompt.substring(0, 100) + '...' })

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url"
    })

    const imageUrl = response.data?.[0]?.url

    if (!imageUrl) {
      throw new Error('No image URL returned from DALL-E')
    }

    return NextResponse.json({ 
      success: true,
      imageUrl: imageUrl,
      prompt: prompt
    })

  } catch (error) {
    console.error('DALL-E API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate image with DALL-E' 
      }, 
      { status: 500 }
    )
  }
}