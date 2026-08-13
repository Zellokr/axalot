<script setup lang="ts">
import { api } from '#convex/api'

const EXAMPLE_PROMPTS = [
  'What access does María have to GitHub?',
  'Explain the policy for Production access.',
  'Give María read access to Jira.'
] as const

const { data: messagePage, status: messageStatus, error: messageError } = await useConvexQuery(
  api.axalotAgent.listMessages,
  { paginationOpts: { cursor: null, numItems: 100 } }
)
const sendMessage = useConvexAction(api.axalotAgent.sendMessage)

const prompt = ref('')
const messageEnd = useTemplateRef<HTMLElement>('messageEnd')
const isSending = computed(() => sendMessage.pending.value)
const conversation = computed(() => buildAgentConversation(messagePage.value?.page ?? []))
const canSubmit = computed(() => canSendAgentPrompt(prompt.value, isSending.value))

function chooseExample(example: string) {
  prompt.value = example
}

async function submitPrompt() {
  if (!canSubmit.value) return

  const submittedPrompt = prompt.value.trim()
  prompt.value = ''

  try {
    await sendMessage({ prompt: submittedPrompt })
  } catch {
    prompt.value = submittedPrompt
  }
}

watch(
  [() => conversation.value.length, isSending],
  async () => {
    await nextTick()
    messageEnd.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }
)
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
          <UBadge
            :color="isSending ? 'info' : 'success'"
            variant="subtle"
            :icon="isSending ? 'i-lucide-loader-circle' : 'i-lucide-circle-check'"
            :label="isSending ? 'Working' : 'Ready'"
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
      <div class="mx-auto flex min-h-full w-full max-w-3xl flex-col px-1 py-4 sm:px-4 sm:py-6">
        <div
          v-if="messageStatus === 'pending'"
          aria-label="Loading conversation"
        >
          <USkeleton class="h-20 w-3/4 rounded-lg" />
        </div>

        <UAlert
          v-else-if="messageError"
          color="error"
          icon="i-lucide-triangle-alert"
          title="Conversation unavailable"
          :description="messageError.message"
        />

        <div
          v-else-if="conversation.length === 0"
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

        <ol
          v-else
          class="space-y-5"
          aria-label="Conversation with Axalot"
        >
          <li
            v-for="item in conversation"
            :key="item.id"
          >
            <article
              v-if="item.kind === 'message'"
              class="max-w-[85%]"
              :class="item.role === 'user' ? 'ml-auto' : ''"
            >
              <p class="mb-1 text-xs font-medium text-muted">
                {{ item.role === 'user' ? 'You' : 'Axalot' }}
              </p>
              <p
                class="whitespace-pre-wrap break-words rounded-lg px-4 py-3 text-sm leading-6 shadow-xs"
                :class="item.role === 'user'
                  ? 'bg-inverted text-inverted'
                  : 'border border-default bg-elevated text-default'"
              >
                {{ item.text }}
              </p>
            </article>

            <div
              v-else
              class="ml-11 flex items-center gap-2 text-xs text-muted"
            >
              <UIcon
                name="i-lucide-shield-check"
                class="size-4 shrink-0 text-info"
              />
              <span class="font-medium text-default">{{ item.label }}</span>
              <span aria-hidden="true">·</span>
              <span>{{ item.detail }}</span>
            </div>
          </li>
        </ol>

        <div
          v-if="isSending"
          class="mt-5 flex items-center gap-3 text-sm text-muted"
          role="status"
          aria-live="polite"
        >
          <UIcon
            name="i-lucide-loader-circle"
            class="size-4 animate-spin text-info"
          />
          Axalot is checking context, policy, and risk…
        </div>

        <div ref="messageEnd" />
      </div>
    </template>

    <template #footer>
      <div class="border-t border-default bg-default/90 px-4 py-3 backdrop-blur sm:px-6 sm:py-4">
        <div class="mx-auto w-full max-w-3xl">
          <UAlert
            v-if="sendMessage.error.value"
            class="mb-3"
            color="error"
            icon="i-lucide-triangle-alert"
            title="Message not sent"
            :description="sendMessage.error.value.message"
          />

          <form
            class="relative"
            @submit.prevent="submitPrompt"
          >
            <UTextarea
              v-model="prompt"
              autoresize
              :rows="2"
              :maxrows="6"
              :disabled="isSending"
              aria-label="Message Axalot"
              placeholder="Ask about access or request an individual change…"
              class="w-full"
              :ui="{ base: 'pe-14' }"
              @keydown.enter.exact.prevent="submitPrompt"
            />
            <UButton
              type="submit"
              icon="i-lucide-arrow-up"
              :loading="isSending"
              :disabled="!canSubmit"
              aria-label="Send message"
              class="absolute bottom-2 right-2"
            />
          </form>

          <p class="mt-2 text-center text-xs text-dimmed">
            Enter to send · Shift+Enter for a new line
          </p>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
