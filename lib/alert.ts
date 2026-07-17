

export async function alertOnFailure(context: string, err: unknown) {
    console.error(context, err)

    const webhookURL = process.env.SLACK_ALERT_WEBHOOK_URL
    if (!webhookURL) return;

    try {
        await fetch(webhookURL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: `:rotating_light: ${context}\n${err instanceof Error ? err.message : String(err)}`,
            })
        })
    } catch {
        // best effort -- alerting itself must never throw or block the caller
    }
}