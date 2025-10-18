import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

interface MessageWithImage {
  role: 'user' | 'assistant'
  content: string
  imageUrl?: string
  imageUrls?: string[]
}

export async function POST(req: NextRequest) {
  try {
    // Debug: Log environment variables
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      HAS_API_KEY: !!process.env.OPENAI_API_KEY,
      API_KEY_PREFIX: process.env.OPENAI_API_KEY?.substring(0, 10)
    })

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

    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 })
    }

    // Process messages to handle images
    const processedMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = messages.map((msg: MessageWithImage) => {
      if (msg.role === 'user' && (msg.imageUrl || (msg.imageUrls && msg.imageUrls.length > 0))) {
        const content: (OpenAI.Chat.Completions.ChatCompletionContentPartText | OpenAI.Chat.Completions.ChatCompletionContentPartImage)[] = [
          {
            type: "text",
            text: msg.content || "What's in these images?"
          }
        ]

        // Add single image if present
        if (msg.imageUrl) {
          content.push({
            type: "image_url",
            image_url: {
              url: msg.imageUrl
            }
          })
        }

        // Add multiple images if present
        if (msg.imageUrls && msg.imageUrls.length > 0) {
          msg.imageUrls.forEach(imageUrl => {
            content.push({
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            })
          })
        }

        return {
          role: 'user',
          content: content
        }
      }
      return {
        role: msg.role,
        content: msg.content
      }
    })

    // Determine model based on whether there are images
    const hasImages = messages.some((msg: MessageWithImage) => msg.imageUrl || (msg.imageUrls && msg.imageUrls.length > 0))
    const model = hasImages ? 'gpt-4o' : 'gpt-4'

    console.log('Sending request to OpenAI:', { model, messageCount: messages.length, hasImages })

    const completion = await openai.chat.completions.create({
      model: model,
      messages: processedMessages,
      max_tokens: 1000,
      temperature: 0.7,
    })

    const response = completion.choices[0]?.message?.content || 'Sorry, I could not generate a response.'

    return NextResponse.json({ 
      success: true,
      message: response 
    })

  } catch (error) {
    console.error('OpenAI API error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to get response from OpenAI' 
      }, 
      { status: 500 }
    )
  }
}