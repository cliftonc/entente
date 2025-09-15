import { createApp } from './index.js'

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const app = createApp(env)
    return app.fetch(request, env, ctx)
  }
}