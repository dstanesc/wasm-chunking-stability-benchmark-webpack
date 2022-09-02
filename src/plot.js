export function trace({ lib, alg, count, bytes, values, text }) {
    return {
        x: ['Blocks Before', 'Blocks After', 'Blocks Diff', 'Blocks Reused', 'Reuse Ratio (%)'],
        y: values,
        type: 'bar',
        text: values.map(String),
        hovertext: text,
        textposition: 'auto',
        name: `${alg}, ${lib}, ${count} chunks, ${bytes} MiB`
    };
}

export function layout(subtitle) {
    return {
        title: subtitle.toString(),
        xaxis: {
            tickangle: -45
        },
        yaxis: {
            type: 'linear',
            autorange: true
        },
        barmode: 'group'
    };
}