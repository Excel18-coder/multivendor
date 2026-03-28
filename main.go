package main

import "fmt"

type Age int

func main() {
	var young Age = 10
	var old Age = 60

	fmt.Println(young + old)

}
