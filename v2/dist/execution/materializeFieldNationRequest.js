export function materializeFieldNationRequest(request, session) {
    if (request.platform !== "FieldNation") {
        throw new Error(`Expected FieldNation request, received ${request.platform}`);
    }
    const resolvedPath = request.path.replace(/<user-id>/g, String(session.userId));
    const body = JSON.parse(JSON.stringify(request.body).replace(/"<user-id>"/g, String(session.userId)));
    return {
        url: `https://app.fieldnation.com${resolvedPath}`,
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            cookie: session.cookies
        },
        body: JSON.stringify(body)
    };
}
