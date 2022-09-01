const path = require("path");

module.exports = {
    entry: "/src/index.js",
    mode: 'development',
    output: { path: path.resolve(__dirname, "dist") },
    target: "web",
    devServer: {
        port: "9500",
        static: ["./public"],
        open: true,
        hot: true,
        liveReload: true
    },
    module: {
        rules: [
            {
                test: /\.m?js/,
                resolve: {
                    fullySpecified: false,
                },
            },
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env", "@babel/preset-react"],
                    },
                },
                resolve: {
                    fallback: {
                    },
                },
            },
            {
                test: /\.css$/i,
                use: ["style-loader", "css-loader"],
            },
        ],
    },
    plugins: [
    ],
    experiments: {
        asyncWebAssembly: true,
        syncWebAssembly: true
    },
};