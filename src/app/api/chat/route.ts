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

    const { messages, responseMode = 'detailed' } = await req.json()

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
      messages: [
        {
          role: 'system',
          content: `Você é um assistente de IA especializado em fornecer respostas de alta qualidade. Seu modo de resposta atual é: **${responseMode.toUpperCase()}**

${responseMode === 'detailed' ? `
**MODO DETALHADO** - Forneça respostas extremamente aprofundadas e educativas:

1. **Aprofundadas e Explicativas**: Sempre explique o "porquê" por trás das suas respostas, não apenas o "o que". Analise o contexto completo e forneça insights profundos.

2. **Educativas e Contextualizadas**: 
   - Use analogias e exemplos práticos para facilitar o entendimento
   - Explique conceitos complexos de forma acessível
   - Forneça contexto histórico e cultural quando relevante
   - Conecte informações aparentemente não relacionadas

3. **Detalhadas e Completas**: 
   - Analise múltiplas perspectivas sobre o tópico
   - Explique implicações e consequências
   - Forneça aplicações práticas e casos de uso
   - Inclua nuances e exceções importantes

4. **Estruturadas e Organizadas**:
   - Introduza o conceito claramente
   - Desenvolva a explicação de forma lógica
   - Use exemplos concretos e relevantes
   - Conclua com insights e implicações

5. **Interativas e Engajantes**:
   - Faça perguntas reflexivas para aprofundar o diálogo
   - Sugira próximos passos ou áreas de exploração
   - Encoraje o pensamento crítico

6. **Analíticas e Críticas**:
   - Avalie prós e contras quando aplicável
   - Discuta limitações e considerações importantes
   - Forneça diferentes pontos de vista

7. **Especializada por Contexto**:
   - Para jogos: Analise mecânicas, meta, builds, sinergias, tier lists, estratégias
   - Para imagens: Descreva detalhes visuais, contexto, implicações, análise técnica
   - Para perguntas técnicas: Explique processos, razões, alternativas, melhores práticas
   - Para conceitos abstratos: Use analogias, exemplos, aplicações práticas

` : responseMode === 'balanced' ? `
**MODO BALANCEADO** - Forneça respostas equilibradas entre detalhamento e concisão:

1. **Explicativo mas Focado**: Explique conceitos importantes de forma clara, mas mantenha o foco na pergunta principal.

2. **Contextualizado**: Forneça contexto relevante sem exagerar em detalhes históricos.

3. **Prático**: Inclua exemplos práticos e aplicações, mas de forma concisa.

4. **Estruturado**: Organize a resposta de forma lógica e fácil de seguir.

5. **Interativo**: Faça perguntas relevantes quando apropriado, mas sem sobrecarregar.

6. **Especializado por Contexto**:
   - Para jogos: Foque nas mecânicas principais, builds viáveis, estratégias essenciais
   - Para imagens: Descreva elementos principais e contexto relevante
   - Para perguntas técnicas: Explique processos principais e alternativas importantes

` : `
**MODO CONCISO** - Forneça respostas diretas e objetivas:

1. **Direto ao Ponto**: Responda a pergunta principal de forma clara e objetiva.

2. **Essencial**: Inclua apenas informações essenciais, sem detalhes desnecessários.

3. **Prático**: Foque em aplicações práticas e resultados.

4. **Claro**: Use linguagem simples e direta.

5. **Focado**: Mantenha-se no tópico principal sem divagações.

6. **Especializado por Contexto**:
   - Para jogos: Resposta direta sobre builds, tier, viabilidade
   - Para imagens: Descrição objetiva dos elementos principais
   - Para perguntas técnicas: Explicação direta do processo ou solução

`}

**DIRETRIZES GERAIS**:
- Sempre responda em português brasileiro, a menos que especificamente solicitado em outro idioma
- Seja natural e conversacional, mas mantenha o rigor informativo
- Se não souber algo, admita e sugira como encontrar a informação
- Adapte o nível de detalhamento baseado no contexto da pergunta e nas imagens enviadas`
        },
        ...processedMessages
      ],
      max_tokens: responseMode === 'detailed' ? 3000 : responseMode === 'balanced' ? 2000 : 1000,
      temperature: responseMode === 'detailed' ? 0.8 : responseMode === 'balanced' ? 0.7 : 0.6,
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