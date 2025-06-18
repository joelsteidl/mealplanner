import { NextAuthOptions } from "next-auth";
import NextAuth from "next-auth/next";
import CredentialsProvider from "next-auth/providers/credentials";
import { client } from "@/sanity/lib/client";
import { groq } from "next-sanity";
import { JWT } from "next-auth/jwt";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Query Sanity for the user
        const user = await client.fetch(
          groq`*[_type == "user" && email == $email][0]`,
          { email: credentials.email }
        );

        // Check if the user is allowed to login
        const allowedUsers = [
          { email: process.env.ALLOWED_EMAIL_1, password: process.env.ALLOWED_PASSWORD_1 },
          { email: process.env.ALLOWED_EMAIL_2, password: process.env.ALLOWED_PASSWORD_2 },
        ];

        const allowedUser = allowedUsers.find(
          (u) => u.email === credentials.email && u.password === credentials.password
        );

        if (!allowedUser || !user) {
          return null;
        }

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as SessionUser).id = token.id as string;
      }
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
