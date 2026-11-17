function parseJsonChunks(chunks, maxBytes) {
  const body = Buffer.concat(chunks);
  if (body.length > maxBytes) throw new Error("payload too large");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(body);
  return text ? JSON.parse(text) : {};
}

function requestBody(request, maxBytes = 10000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    request.on("data", chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > maxBytes) {
        fail(new Error("payload too large"));
        request.resume();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (settled) return;
      try {
        const parsed = parseJsonChunks(chunks, maxBytes);
        settled = true;
        resolve(parsed);
      } catch (error) {
        fail(error);
      }
    });
    request.on("aborted", () => fail(new Error("request aborted")));
    request.on("error", fail);
  });
}

module.exports = { parseJsonChunks, requestBody };
