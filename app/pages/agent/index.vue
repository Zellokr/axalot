<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
import { DefaultChatTransport, getToolName, isToolUIPart } from 'ai'
import { isPartStreaming, isToolStreaming } from '@nuxt/ui/utils/ai'
import { api } from '#convex/api'

const EXAMPLE_PROMPTS = [
  'What access does María have to GitHub?',
  'Explain the policy for Production access.',
  'Give María read access to Jira.'
] as const

const toast = useToast()
const config = useRuntimeConfig()

const { data: messagePage, status: messageStatus, error: messageError } = await useConvexQuery(
  api.axalotAgent.listMessages,
  { paginationOpts: { cursor: null, numItems: 100 } }
)
const clearHistory = useConvexMutation(api.axalotAgent.clearHistory)

const { messages, status, error, sendMessage, stop, regenerate, clearError } = useChat({
  messages: buildInitialMessages(messagePage.value?.page ?? []),
  transport: new DefaultChatTransport({
    api: `${config.public.convex.siteUrl}/agent-chat`
  })
})

const prompt = ref('')
const showClearModal = ref(false)
const clearingHistory = ref(false)
const isSending = computed(() => status.value === 'submitted' || status.value === 'streaming')
const canSubmit = computed(() => canSendAgentPrompt(prompt.value, isSending.value))

const chatAnchor = useTemplateRef('chatAnchor')

function scrollChatToBottom() {
  const scrollParent = chatAnchor.value?.closest('[data-slot="body"]')

  if (!(scrollParent instanceof HTMLElement)) return

  scrollParent.scrollTo({ top: scrollParent.scrollHeight, behavior: 'smooth' })
}

watch(messages, () => {
  nextTick(scrollChatToBottom)
}, { deep: true })

async function chooseExample(example: string) {
  if (isSending.value) return
  await sendMessage({ text: example })
}

async function confirmClearHistory() {
  clearingHistory.value = true

  try {
    await clearHistory({})
    messages.value = []
    clearError()
    showClearModal.value = false
    toast.add({ title: 'Conversation cleared', color: 'success' })
  } catch (err) {
    toast.add({
      title: 'Could not clear conversation',
      description: (err as Error).message,
      color: 'error'
    })
  } finally {
    clearingHistory.value = false
  }
}

async function submitPrompt() {
  if (!canSubmit.value) return

  const submittedPrompt = prompt.value.trim()
  prompt.value = ''
  await sendMessage({ text: submittedPrompt })
}
</script>

<template>
  <UDashboardPanel id="agent">
    <template #header>
      <UDashboardNavbar
        title="Agent"
        :ui="{ root: 'border-b-0' }"
      >
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            v-if="messages.length > 0"
            icon="i-lucide-trash-2"
            color="neutral"
            variant="ghost"
            aria-label="Clear conversation"
            @click="showClearModal = true"
          />
          <UBadge
            :color="error ? 'error' : isSending ? 'info' : 'success'"
            variant="subtle"
            :icon="error ? 'i-lucide-circle-alert' : isSending ? 'i-lucide-loader-circle' : 'i-lucide-circle-check'"
            :label="error ? 'Needs attention' : isSending ? 'Working' : 'Ready'"
          />
        </template>
      </UDashboardNavbar>

      <div class="border-b border-default px-4 pb-4 sm:px-6">
        <p class="text-sm text-muted">
          Manage individual employee access with a policy-governed IAM assistant.
        </p>
        <div class="mt-2 flex items-center gap-2 text-xs text-dimmed">
          <UIcon
            name="i-lucide-shield-check"
            class="size-4 text-success"
          />
          <span>The Policy Engine authorizes every access change. Axalot cannot bypass it.</span>
        </div>
      </div>
    </template>

    <template #body>
      <div
        ref="chatAnchor"
        class="mx-auto flex min-h-full w-full max-w-3xl flex-col px-1 py-4 sm:px-4 sm:py-6"
      >
        <div
          v-if="messageStatus === 'pending'"
          class="py-3"
          aria-label="Loading conversation"
          role="status"
          aria-live="polite"
        >
          <UChatShimmer text="Loading conversation…" />
        </div>

        <UAlert
          v-else-if="messageError"
          color="error"
          icon="i-lucide-triangle-alert"
          title="Conversation unavailable"
          :description="messageError.message"
        />

        <div
          v-else-if="messages.length === 0"
          class="my-auto py-10 text-center"
        >
          <UIcon
            name="i-lucide-bot"
            class="size-8 text-highlighted"
          />
          <h2 class="mt-4 text-lg font-semibold text-highlighted">
            Ask Axalot about access
          </h2>
          <p class="mx-auto mt-2 max-w-md text-sm text-muted">
            Inspect permissions, understand policy, or request one individual access change.
          </p>

          <div class="mx-auto mt-6 grid max-w-xl gap-2 text-left sm:grid-cols-3">
            <UButton
              v-for="example in EXAMPLE_PROMPTS"
              :key="example"
              color="neutral"
              variant="outline"
              class="h-auto items-start justify-start whitespace-normal px-3 py-3 text-left"
              @click="chooseExample(example)"
            >
              {{ example }}
            </UButton>
          </div>
        </div>

        <UChatMessages
          v-else
          :messages="messages"
          :status="status"
          :user="{ icon: 'i-lucide-user', side: 'right', variant: 'soft' }"
          :assistant="{ icon: 'i-lucide-bot', side: 'left', variant: 'naked' }"
          should-auto-scroll
          aria-label="Conversation with Axalot"
        >
          <template #content="{ message }">
            <template
              v-for="(part, index) in message.parts"
              :key="`${message.id}-${part.type}-${index}`"
            >
              <Markdown
                v-if="part.type === 'text' && message.role === 'assistant'"
                :value="part.text"
                :streaming="isPartStreaming(part)"
                class="*:first:mt-0 *:last:mb-0"
              />
              <p
                v-else-if="part.type === 'text' && message.role === 'user'"
                class="whitespace-pre-wrap"
              >
                {{ part.text }}
              </p>
              <UChatTool
                v-else-if="isToolUIPart(part)"
                :text="TOOL_LABELS[getToolName(part)] ?? getToolName(part)"
                :suffix="toolStateLabel(part.state)"
                :streaming="isToolStreaming(part)"
                icon="i-lucide-shield-check"
              />
            </template>
          </template>

          <template #indicator>
            <UChatShimmer
              text="Axalot is checking context, policy, and risk…"
              role="status"
              aria-live="polite"
            />
          </template>
        </UChatMessages>
      </div>

      <UModal
        :open="showClearModal"
        title="Clear conversation"
        description="This permanently deletes the conversation history with Axalot. This action cannot be undone."
        :ui="{ footer: 'justify-end' }"
        @update:open="(value) => { if (!value) showClearModal = false }"
      >
        <template #footer>
          <UButton
            label="Cancel"
            color="neutral"
            variant="outline"
            @click="showClearModal = false"
          />
          <UButton
            label="Clear"
            color="error"
            :loading="clearingHistory"
            @click="confirmClearHistory"
          />
        </template>
      </UModal>
    </template>

    <template #footer>
      <div class="border-t border-default bg-default/90 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div class="mx-auto w-full max-w-3xl">
          <UAlert
            v-if="error"
            class="mb-3"
            color="error"
            icon="i-lucide-triangle-alert"
            title="Message not sent"
            :description="error.message"
            role="alert"
          />

          <UChatPrompt
            v-model="prompt"
            :error="error"
            :disabled="isSending"
            :rows="2"
            :maxrows="6"
            aria-label="Message Axalot"
            placeholder="Ask about access or request an individual change…"
            class="w-full"
            @submit="submitPrompt"
          >
            <template #footer>
              <span class="text-xs text-dimmed">
                Enter to send · Shift+Enter for a new line
              </span>
              <UChatPromptSubmit
                :status="status"
                :disabled="!canSubmit"
                @stop="stop()"
                @reload="regenerate()"
              />
            </template>
          </UChatPrompt>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
