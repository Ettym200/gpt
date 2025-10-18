'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { TextAnimate } from '@/components/ui/text-animate'
import { SendIcon, BotIcon, UserIcon, LoaderIcon, ImageIcon, XIcon, SaveIcon, TrashIcon, MenuIcon, PlusIcon } from 'lucide-react'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  imageUrl?: string
  imageUrls?: string[]
  generatedImage?: string
  imagePrompt?: string
}

interface SavedChat {
  id: string
  title: string
  messages: Message[]
  createdAt: Date
  updatedAt: Date
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [selectedImages, setSelectedImages] = useState<string[]>([])
  const [savedChats, setSavedChats] = useState<SavedChat[]>([])
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [chatTitle, setChatTitle] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentChatId, setCurrentChatId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load saved chats from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('savedChats')
    if (saved) {
      try {
        const parsedChats = JSON.parse(saved).map((chat: SavedChat & { createdAt: string; updatedAt: string; messages: Array<Message & { timestamp: string }> }) => ({
          ...chat,
          createdAt: new Date(chat.createdAt),
          updatedAt: new Date(chat.updatedAt),
          messages: chat.messages.map((msg: Message & { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }))
        setSavedChats(parsedChats)
      } catch (error) {
        console.error('Error loading saved chats:', error)
      }
    }
  }, [])

  // Handle sidebar visibility based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true)
      } else {
        setSidebarOpen(false)
      }
    }

    handleResize() // Set initial state
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isImageGenerationRequest = (text: string): boolean => {
    const imageKeywords = [
      'gerar imagem', 'criar imagem', 'desenhar', 'ilustrar', 'fazer um desenho',
      'generate image', 'create image', 'draw', 'illustrate', 'make a drawing',
      'pintar', 'pintura', 'arte', 'art', 'painting', 'sketch', 'esboço'
    ]
    
    const lowerText = text.toLowerCase()
    return imageKeywords.some(keyword => lowerText.includes(keyword))
  }

  const generateImage = async (prompt: string): Promise<string | null> => {
    try {
      setIsGeneratingImage(true)
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })

      const data = await response.json()

      if (data.success) {
        return data.imageUrl
      } else {
        throw new Error(data.error || 'Failed to generate image')
      }
    } catch (error) {
      console.error('Error generating image:', error)
      return null
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      Array.from(files).forEach(file => {
        processImageFile(file)
      })
    }
  }

  const processImageFile = (file: File) => {
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB')
      return
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }

    // Check if we already have too many images (max 5)
    if (selectedImages.length >= 5) {
      alert('Maximum 5 images allowed')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const imageUrl = event.target?.result as string
      setSelectedImages(prev => [...prev, imageUrl])
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      
      if (item.type.startsWith('image/')) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) {
          processImageFile(file)
        }
        break
      }
    }
  }

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index))
  }

  const removeAllImages = () => {
    setSelectedImages([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const generateChatTitle = (messages: Message[]): string => {
    const firstUserMessage = messages.find(msg => msg.role === 'user')
    if (firstUserMessage && firstUserMessage.content) {
      return firstUserMessage.content.slice(0, 50) + (firstUserMessage.content.length > 50 ? '...' : '')
    }
    return `Conversa ${new Date().toLocaleDateString()}`
  }

  const saveChat = () => {
    if (messages.length === 0) {
      alert('Não há mensagens para salvar')
      return
    }

    const title = chatTitle.trim() || generateChatTitle(messages)
    
    let updatedChats: SavedChat[]
    
    if (currentChatId) {
      // Atualizar chat existente
      updatedChats = savedChats.map(chat => 
        chat.id === currentChatId 
          ? { ...chat, title, messages: [...messages], updatedAt: new Date() }
          : chat
      )
    } else {
      // Criar novo chat
      const newChat: SavedChat = {
        id: Date.now().toString(),
        title,
        messages: [...messages],
        createdAt: new Date(),
        updatedAt: new Date()
      }
      updatedChats = [...savedChats, newChat]
      setCurrentChatId(newChat.id)
    }

    setSavedChats(updatedChats)
    localStorage.setItem('savedChats', JSON.stringify(updatedChats))
    
    setShowSaveDialog(false)
    setChatTitle('')
    alert('Conversa salva com sucesso!')
  }

  const loadChat = (chat: SavedChat) => {
    setMessages(chat.messages)
    setCurrentChatId(chat.id)
    scrollToBottom()
  }

  const deleteChat = (chatId: string) => {
    if (confirm('Tem certeza que deseja deletar esta conversa?')) {
      const updatedChats = savedChats.filter(chat => chat.id !== chatId)
      setSavedChats(updatedChats)
      localStorage.setItem('savedChats', JSON.stringify(updatedChats))
      
      // Se o chat deletado é o atual, limpar a conversa
      if (currentChatId === chatId) {
        setMessages([])
        setSelectedImages([])
        setInput('')
        setCurrentChatId(null)
      }
    }
  }

  const clearCurrentChat = () => {
    if (messages.length > 0 && confirm('Tem certeza que deseja limpar a conversa atual?')) {
      setMessages([])
      setSelectedImages([])
      setInput('')
      setCurrentChatId(null)
    }
  }

  const startNewChat = () => {
    setMessages([])
    setSelectedImages([])
    setInput('')
    setCurrentChatId(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!input.trim() && selectedImages.length === 0) || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      imageUrls: selectedImages.length > 0 ? selectedImages : undefined,
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = input.trim()
    setInput('')
    setSelectedImages([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setIsLoading(true)

    try {
      // Check if user is asking for image generation
      if (isImageGenerationRequest(currentInput) && selectedImages.length === 0) {
        const generatedImageUrl = await generateImage(currentInput)
        
        if (generatedImageUrl) {
          const assistantMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `Aqui está a imagem que você pediu:`,
            timestamp: new Date(),
            generatedImage: generatedImageUrl,
            imagePrompt: currentInput,
          }
          setMessages(prev => [...prev, assistantMessage])
          setIsLoading(false)
          return
        } else {
          // Fallback to text response if image generation fails
          const fallbackMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: 'Desculpe, não consegui gerar a imagem. Vou responder com texto.',
            timestamp: new Date(),
          }
          setMessages(prev => [...prev, fallbackMessage])
        }
      }

      // Regular chat response
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.role,
            content: msg.content,
            imageUrl: msg.imageUrl,
            imageUrls: msg.imageUrls,
          })),
        }),
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} transition-all duration-300 overflow-hidden border-r bg-background relative z-50`}>
        <div className="h-full flex flex-col">
          {/* Sidebar Header */}
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <BotIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">ChatGPT</h2>
                  <p className="text-xs text-muted-foreground">AI Assistant</p>
                </div>
              </div>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button
              onClick={startNewChat}
              className="w-full flex items-center space-x-2"
              variant="outline"
            >
              <PlusIcon className="w-4 h-4" />
              <span>Nova Conversa</span>
            </Button>
          </div>

          {/* Saved Chats List */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Conversas Salvas</h3>
            <div className="space-y-2">
              {savedChats.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma conversa salva
                </p>
              ) : (
                savedChats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      currentChatId === chat.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => loadChat(chat)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{chat.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {chat.messages.length} mensagens
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {chat.updatedAt.toLocaleDateString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChat(chat.id)
                        }}
                        className="ml-2 h-6 w-6 p-0"
                      >
                        <TrashIcon className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Sidebar Footer */}
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <ModeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={messages.length === 0}
                className="flex items-center space-x-1"
              >
                <SaveIcon className="w-4 h-4" />
                <span>Salvar</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden"
            >
              <MenuIcon className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">
                {currentChatId 
                  ? savedChats.find(chat => chat.id === currentChatId)?.title || 'ChatGPT'
                  : 'Nova Conversa'
                }
              </h1>
              <p className="text-sm text-muted-foreground">AI Assistant</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearCurrentChat}
              disabled={messages.length === 0}
              className="flex items-center space-x-1"
            >
              <TrashIcon className="w-4 h-4" />
              <span>Limpar</span>
            </Button>
            <div className="lg:hidden">
              <ModeToggle />
            </div>
          </div>
        </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
              <BotIcon className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">How can I help you today?</h2>
            <p className="text-muted-foreground max-w-md">
              Start a conversation with ChatGPT. Ask questions, get explanations, discuss any topic, or ask me to generate images using DALL-E 3.
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <Card className={`max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className={message.role === 'user' ? 'bg-primary-foreground text-primary' : 'bg-muted'}>
                        {message.role === 'user' ? <UserIcon className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge variant={message.role === 'user' ? 'secondary' : 'outline'}>
                          {message.role === 'user' ? 'You' : 'ChatGPT'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                        {message.generatedImage && (
                          <Badge variant="secondary" className="text-xs">
                            🎨 Generated with DALL-E 3
                          </Badge>
                        )}
                      </div>
                      
                      {/* Generated image */}
                      {message.generatedImage && (
                        <div className="mb-3">
                          <Image 
                            src={message.generatedImage} 
                            alt={message.imagePrompt || "Generated image"} 
                            width={400}
                            height={400}
                            className="max-w-full h-auto rounded-lg border"
                            style={{ maxHeight: '400px' }}
                          />
                          {message.imagePrompt && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Prompt: &quot;{message.imagePrompt}&quot;
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Uploaded images preview for user messages */}
                      {message.imageUrl && !message.generatedImage && (
                        <div className="mb-3">
                          <Image 
                            src={message.imageUrl} 
                            alt="Uploaded image" 
                            width={300}
                            height={300}
                            className="max-w-full h-auto rounded-lg border"
                            style={{ maxHeight: '300px' }}
                          />
                        </div>
                      )}
                      
                      {/* Multiple uploaded images preview for user messages */}
                      {message.imageUrls && message.imageUrls.length > 0 && !message.generatedImage && (
                        <div className="mb-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {message.imageUrls.map((imageUrl, index) => (
                              <Image 
                                key={index}
                                src={imageUrl} 
                                alt={`Uploaded image ${index + 1}`} 
                                width={200}
                                height={200}
                                className="max-w-full h-auto rounded-lg border"
                                style={{ maxHeight: '200px' }}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {message.role === 'assistant' ? (
                        <TextAnimate
                          by="word"
                          animation="blurInUp"
                          duration={0.4}
                          delay={0.1}
                          className="whitespace-pre-wrap"
                        >
                          {message.content}
                        </TextAnimate>
                      ) : (
                        <div className="whitespace-pre-wrap">{message.content}</div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
        
        {(isLoading || isGeneratingImage) && (
          <div className="flex justify-start">
            <Card className="max-w-[80%]">
              <CardContent className="p-4">
                <div className="flex items-start space-x-3">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-muted">
                      <BotIcon className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex items-center space-x-2">
                    <LoaderIcon className="w-4 h-4 animate-spin" />
                    <span className="text-muted-foreground">
                      {isGeneratingImage ? 'Generating image with DALL-E 3...' : 'Thinking...'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <Separator />

      {/* Input */}
      <div className="p-4">
        {/* Selected images preview */}
        {selectedImages.length > 0 && (
          <div className="mb-4">
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedImages.map((image, index) => (
                <div key={index} className="relative inline-block">
                  <div className="relative">
                    <Image 
                      src={image} 
                      alt={`Selected image ${index + 1}`} 
                      width={128}
                      height={100}
                      className="max-w-32 h-auto rounded-lg border"
                      style={{ maxHeight: '100px' }}
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 w-5 h-5"
                      onClick={() => removeImage(index)}
                    >
                      <XIcon className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {selectedImages.length} imagem{selectedImages.length > 1 ? 's' : ''} pronta{selectedImages.length > 1 ? 's' : ''} para enviar
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={removeAllImages}
                className="text-xs"
              >
                Remover todas
              </Button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <div className="flex-1 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              onPaste={handlePaste}
              placeholder="Message ChatGPT... (Ask to generate images or Ctrl+V to paste)"
              className="pr-12"
              disabled={isLoading || isGeneratingImage}
            />
            
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {/* Image upload button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || isGeneratingImage}
            >
              <ImageIcon className="w-4 h-4" />
            </Button>
          </div>
          
          <Button type="submit" disabled={(!input.trim() && selectedImages.length === 0) || isLoading || isGeneratingImage} className="px-4">
            <SendIcon className="w-4 h-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Press Enter to send • Click 📷 to upload multiple images • Ctrl+V to paste • Ask &quot;generate image&quot; for DALL-E 3
        </p>
      </div>
      </div>

      {/* Save Chat Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-96">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">Salvar Conversa</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Título da conversa:</label>
                  <Input
                    value={chatTitle}
                    onChange={(e) => setChatTitle(e.target.value)}
                    placeholder={generateChatTitle(messages)}
                    className="w-full"
                  />
                </div>
                <div className="flex space-x-2">
                  <Button onClick={saveChat} className="flex-1">
                    {currentChatId ? 'Atualizar' : 'Salvar'}
                  </Button>
                  <Button variant="outline" onClick={() => setShowSaveDialog(false)} className="flex-1">
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}